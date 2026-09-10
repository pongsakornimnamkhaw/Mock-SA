// seed-reports installs persistent PostgreSQL records for the completed-concert report.
// It is idempotent and never updates or deletes existing application records.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"backend/internal/config"
	"backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

const (
	seedKey  = "REPORT_DATA_V1"
	markerID = "REPORT_DATA_V1_COMPLETE"
)

type zoneSpec struct {
	code, name string
	sold       int
	price      float64
}

type concertSpec struct {
	id, name, date, startTime, endTime, location, status, poster string
	budget                                                       float64
	sponsor                                                      string
	zones                                                        []zoneSpec
}

var concerts = []concertSpec{
	{
		id: "CC_REPORT_NEON_FLUX", name: "Neon Flux", date: "2024-08-16",
		startTime: "17:00", endTime: "23:30", location: "ศูนย์การค้าสยามพารากอน กรุงเทพมหานคร",
		status: "ตรวจสอบข้อมูลเสร็จสิ้น", poster: "flux.png", budget: 18_000_000,
		sponsor: "บริษัท ออคตาเวีย มีเดีย จำกัด",
		zones:   []zoneSpec{{"A", "Zone A", 1000, 10000}, {"B", "Zone B", 2000, 6500}, {"C", "Zone C", 2000, 3665}},
	},
	{
		id: "CC_REPORT_NEON_PULSE", name: "Neon Pulse", date: "2024-10-18",
		startTime: "18:30", endTime: "23:00", location: "The Mall Korat นครราชสีมา",
		status: "กำลังตรวจสอบข้อมูล", poster: "pulse.png", budget: 10_000_000,
		sponsor: "บริษัท ช้างมิวสิค จำกัด",
		zones:   []zoneSpec{{"VIP", "VIP", 2052, 10000}},
	},
	{
		id: "CC_REPORT_CELESTIAL", name: "Celestial Sounds", date: "2024-10-26",
		startTime: "18:00", endTime: "23:00", location: "ลานเฉลิมพระเกียรติ เชียงใหม่",
		status: "กำลังตรวจสอบข้อมูล", poster: "celestial.png", budget: 8_500_000,
		sponsor: "บริษัท นอร์ทสตาร์ เอ็นเตอร์เทนเมนต์ จำกัด",
		zones:   []zoneSpec{{"A", "Zone A", 1000, 5000}, {"B", "Zone B", 1500, 3500}, {"C", "Zone C", 1500, 2500}},
	},
}

func main() {
	apply := flag.Bool("apply", false, "insert the report dataset into PostgreSQL")
	flag.Parse()
	if !*apply {
		printPreview()
		return
	}
	if _, err := os.Stat(".env"); err != nil {
		fmt.Fprintln(os.Stderr, "Run from backend with backend/.env present; refusing an implicit database target.")
		os.Exit(1)
	}
	posters, err := loadPosters()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	config.LoadEnv()
	config.ConnectDB()
	db := config.DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)})
	sqlDB, err := db.DB()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer sqlDB.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	created, err := seed(db.WithContext(ctx), posters)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Report data insert failed; transaction rolled back:", err)
		os.Exit(1)
	}
	if !created {
		fmt.Println("Report dataset already exists. No records were changed.")
		return
	}
	printTotals()
}

func printPreview() {
	fmt.Println("Persistent report records: Neon Flux (5,000 tickets / 30,330,000 baht), Neon Pulse (2,052 / 20,520,000), Celestial Sounds (4,000 / 14,000,000).")
	fmt.Println("Run from backend: go run ./cmd/seed-reports --apply")
}

func printTotals() {
	fmt.Println("Inserted persistent PostgreSQL report data successfully:")
	for _, spec := range concerts {
		tickets, revenue := totals(spec)
		fmt.Printf("- %s: %s tickets, %.0f baht\n", spec.name, formatInt(tickets), revenue)
	}
	fmt.Println("Existing records were not updated or deleted. Re-running the command is safe and creates no duplicates.")
}

func totals(spec concertSpec) (int, float64) {
	tickets := 0
	revenue := 0.0
	for _, zone := range spec.zones {
		tickets += zone.sold
		revenue += float64(zone.sold) * zone.price
	}
	return tickets, revenue
}

func formatInt(value int) string {
	if value < 1000 {
		return fmt.Sprintf("%d", value)
	}
	return fmt.Sprintf("%d,%03d", value/1000, value%1000)
}

func loadPosters() (map[string][]byte, error) {
	result := make(map[string][]byte, len(concerts))
	for _, spec := range concerts {
		path := filepath.Join("..", "frontend", "src", "assets", "Poster", spec.poster)
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read poster %s: %w", path, err)
		}
		result[spec.poster] = data
	}
	return result, nil
}

func create(tx *gorm.DB, value any) error {
	return tx.Omit(clause.Associations).Create(value).Error
}

func seed(db *gorm.DB, posters map[string][]byte) (bool, error) {
	created := false
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", seedKey).Error; err != nil {
			return err
		}
		var markerCount int64
		if err := tx.Model(&models.ModifiedHistory{}).Where("history_id = ?", markerID).Count(&markerCount).Error; err != nil {
			return err
		}
		if markerCount > 0 {
			return nil
		}
		ids := make([]string, 0, len(concerts))
		for _, spec := range concerts {
			ids = append(ids, spec.id)
		}
		var existing int64
		if err := tx.Model(&models.Concert{}).Where("concert_id IN ?", ids).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return fmt.Errorf("found %d target concert IDs without completion marker; refusing to overwrite", existing)
		}

		for index, spec := range concerts {
			if err := seedConcert(tx, index, spec, posters[spec.poster]); err != nil {
				return err
			}
		}
		if err := create(tx, &models.ModifiedHistory{
			HistoryID: markerID, ConcertID: concerts[0].id, ActionType: "REPORT_DATA_SEED",
			Description: "ติดตั้งข้อมูลคอนเสิร์ตที่เสร็จสิ้นแล้วสำหรับทดสอบรายงาน", CreatedAt: time.Now().UTC(),
		}); err != nil {
			return err
		}
		created = true
		return nil
	})
	return created, err
}

func seedConcert(tx *gorm.DB, index int, spec concertSpec, poster []byte) error {
	eventDate, err := time.Parse("2006-01-02", spec.date)
	if err != nil {
		return err
	}
	updatedAt := eventDate.AddDate(0, 0, 2).Add(14 * time.Hour)
	concert := models.Concert{
		ConcertID: spec.id, ConcertName: spec.name, StartDate: spec.date, EndDate: spec.date,
		StartTime: spec.startTime, EndTime: spec.endTime, Location: spec.location, Status: spec.status,
		ConcertPoster: poster, Poster: poster, MoreInfo: "ข้อมูลคอนเสิร์ตสำหรับระบบรายงานหลังจบงาน",
		BaseModel: models.BaseModel{CreatedAt: eventDate.AddDate(0, -3, 0), UpdatedAt: updatedAt},
	}
	if err := create(tx, &concert); err != nil {
		return err
	}

	bookingID := fmt.Sprintf("BK_REPORT_%02d", index+1)
	if err := create(tx, &models.Booking{BookingID: bookingID, BookingDate: eventDate.AddDate(0, -1, 0), Status: "ชำระเงินแล้ว"}); err != nil {
		return err
	}
	if err := create(tx, &models.Payment{PaymentID: fmt.Sprintf("PY_REPORT_%02d", index+1), BookingID: bookingID, PaymentStatus: "ชำระเงินสำเร็จ", EvidenceFile: []byte("report-data-payment-reference")}); err != nil {
		return err
	}

	_, revenue := totals(spec)
	promotionID := fmt.Sprintf("PR_REPORT_%02d", index+1)
	promotion := models.Promotion{
		PromotionID: promotionID, PromotionName: "ราคาจำหน่าย " + spec.name,
		Description: "รายการราคาอ้างอิงสำหรับรายงานยอดจำหน่ายบัตร", BannerImageUrl: poster,
		Status: "expired", ZoneType: "all", CreatedAt: eventDate.AddDate(0, -3, 0), UpdatedAt: updatedAt,
		TotalRevenue: revenue, ConcertID: spec.id,
	}
	if err := create(tx, &promotion); err != nil {
		return err
	}
	if err := create(tx, &models.WorkPlan{
		PlanID: fmt.Sprintf("WP_REPORT_%02d", index+1), ScheduleDetail: "[]", Budget: spec.budget,
		ApprovalStatus: "เสร็จสิ้น", UpdateDate: updatedAt, ConcertID: spec.id,
	}); err != nil {
		return err
	}
	if err := create(tx, &models.SponsorshipRequest{
		RequestID: fmt.Sprintf("SP_REPORT_%02d", index+1),
		AdPackage: fmt.Sprintf(`{"company_name":%q,"packages":[{"ad_type":"ป้าย 5 จุด","size":"มาตรฐาน","count":5,"price":80000}]}`, spec.sponsor),
		LogoURL:   "database://report-sponsor-logo", AgreementDocURL: "database://report-sponsor-contract",
		SubmitDate: eventDate.AddDate(0, -2, 0), Status: "approved", ConcertID: spec.id,
	}); err != nil {
		return err
	}

	for zoneIndex, zone := range spec.zones {
		zoneID := fmt.Sprintf("ZN_REPORT_%02d_%s", index+1, zone.code)
		if err := create(tx, &models.Zone{ZoneID: zoneID, ConcertID: spec.id, ZoneType: zone.name, Capacity: zone.sold, ZonePrice: zone.price}); err != nil {
			return err
		}
		if err := create(tx, &models.TicketCategory{
			CategoryID:   fmt.Sprintf("TC_REPORT_%02d_%02d", index+1, zoneIndex+1),
			CategoryName: zone.name, Price: zone.price, Quantity: zone.sold,
			PromotionName: promotion.PromotionName, PromotionID: promotionID, ZoneID: zoneID,
		}); err != nil {
			return err
		}
		seats := make([]models.Seat, 0, zone.sold)
		for seatIndex := 1; seatIndex <= zone.sold; seatIndex++ {
			seats = append(seats, models.Seat{
				SeatRow: (seatIndex-1)/50 + 1, SeatColumn: (seatIndex-1)%50 + 1,
				SeatLabel: fmt.Sprintf("%s-%04d", zone.code, seatIndex), StatusSeat: "sold", ZoneID: zoneID,
			})
		}
		if err := tx.Omit(clause.Associations).CreateInBatches(seats, 500).Error; err != nil {
			return err
		}
		tickets := make([]models.Ticket, 0, zone.sold)
		for seatIndex := range seats {
			tickets = append(tickets, models.Ticket{
				NameConcert: spec.name, TicketDateTime: eventDate.AddDate(0, -1, 0).Add(time.Duration((seatIndex+1)%720) * time.Minute),
				PriceTicket: zone.price, StatusTicket: "paid", SeatID: seats[seatIndex].SeatID, BookingID: bookingID,
			})
		}
		if err := tx.Omit(clause.Associations).CreateInBatches(tickets, 500).Error; err != nil {
			return err
		}
	}
	return nil
}
