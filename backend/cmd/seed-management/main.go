// seed-management adds an explicitly labelled, local-development dataset only.
// It never migrates tables or updates/deletes existing application records.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"os"
	"strings"
	"time"

	"backend/internal/config"
	"backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

const prefix = "DEMO_MGMT_V1_"
const markerID = prefix + "SEED_COMPLETE"
const venuePrefix = "DEMO_VENUE_V1_"
const venueMarkerID = venuePrefix + "SEED_COMPLETE"

var venueConcertIDs = []string{"CC0001", "CC0002", "CC0003"}

type employeeSpec struct {
	name, department, permission, scope string
}

var employees = []employeeSpec{
	{"แอดมินทดสอบเอ", "ฝ่ายบุคคล", "admin", "all"},
	{"แอดมินทดสอบบี", "ฝ่ายการตลาด", "admin", "all"},
	{"พนักงานทดสอบซี", "ฝ่ายการตลาด", "edit", "promotions"},
	{"พนักงานทดสอบดี", "ฝ่ายบุคคล", "edit", "users"},
	{"พนักงานทดสอบอี", "ฝ่ายโปรดักชั่น", "edit", "all"},
	{"พนักงานทดสอบเอฟ", "ฝ่ายการเงิน", "view_only", ""},
	{"พนักงานทดสอบจี", "ฝ่ายสถานที่", "view_only", ""},
	{"พนักงานทดสอบเอช", "ฝ่ายประชาสัมพันธ์", "view_only", ""},
}

type promotionSpec struct {
	name, code, discountType, status, approval string
	value, cap                                 float64
	used                                       int
}

var promotions = []promotionSpec{
	{"Early Bird ลด 10%", "TEST-MGMT-EARLY10", "percent", "active", "approved", 10, 300, 12},
	{"ลดทันที 200 บาท", "TEST-MGMT-SAVE200", "fixed", "active", "approved", 200, 0, 6},
	{"VIP ลด 20%", "TEST-MGMT-VIP20", "percent", "active", "approved", 20, 500, 3},
	{"แคมเปญเก่า ลด 15%", "TEST-MGMT-OLD15", "percent", "expired", "approved", 15, 400, 4},
	{"แคมเปญเก่า ลด 100 บาท", "TEST-MGMT-OLD100", "fixed", "expired", "approved", 100, 0, 2},
	{"รออนุมัติ ลด 25%", "TEST-MGMT-WAIT25", "percent", "draft", "pending", 25, 600, 0},
	{"รออนุมัติ ลด 300 บาท", "TEST-MGMT-WAIT300", "fixed", "draft", "pending", 300, 0, 0},
	{"รออนุมัติ ลด 5%", "TEST-MGMT-WAIT5", "percent", "draft", "pending", 5, 150, 0},
	{"ไม่ผ่านอนุมัติ ลด 40%", "TEST-MGMT-REJECT40", "percent", "draft", "rejected", 40, 800, 0},
	{"ไม่ผ่านอนุมัติ ลด 500 บาท", "TEST-MGMT-REJECT500", "fixed", "draft", "rejected", 500, 0, 0},
}

func main() {
	apply := flag.Bool("apply", false, "Insert demo records into the database configured in backend/.env")
	flag.Parse()
	if !*apply {
		fmt.Println("Preview: management demos plus publications, performance schedules, zones, seats, tickets and layout images for CC0001-CC0003.")
		fmt.Println("Run from backend: go run ./cmd/seed-management --apply")
		fmt.Println("Development data only. Adds DEMO_MGMT_V1_ and DEMO_VENUE_V1_ records once; does not overwrite existing data, migrate tables or create bookings/payments.")
		return
	}
	if _, err := os.Stat(".env"); err != nil {
		fmt.Fprintln(os.Stderr, "Run from backend with an existing .env; refusing to use an implicit database.")
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
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	created, err := seed(db.WithContext(ctx), time.Now())
	if err != nil {
		fmt.Fprintln(os.Stderr, "Demo seed failed; all inserts rolled back:", err)
		os.Exit(1)
	}
	if !created {
		fmt.Println("Demo dataset already installed. Skipped all writes, preserving edits, decisions and deletions made during testing.")
		return
	}
	fmt.Println("Demo data is ready: management records plus 3 publications, 6 performance schedules, 6 venue zones, 36 seats and 36 tickets.")
	fmt.Println("Demo IDs use DEMO_MGMT_V1_ or DEMO_VENUE_V1_; existing values and records are preserved.")
}

func create(tx *gorm.DB, row any) error {
	// Explicit inserts only: never save/upsert related application objects.
	return tx.Omit(clause.Associations).Create(row).Error
}

func seed(db *gorm.DB, now time.Time) (bool, error) {
	created := false
	err := db.Transaction(func(tx *gorm.DB) error {
		// Concurrent/repeated runs install this complete dataset at most once.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", prefix).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.EmpActivityLogs{}).Where("emp_log_id = ?", markerID).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			venueCreated, err := seedVenueData(tx, now)
			created = venueCreated
			return err
		}
		var concerts []models.Concert
		if err := tx.Select("concert_id").Order("concert_id").Find(&concerts).Error; err != nil {
			return err
		}
		if len(concerts) == 0 {
			return fmt.Errorf("at least one existing concert is required; no concerts were created or changed")
		}
		availableConcerts := make(map[string]bool, len(concerts))
		for _, concert := range concerts {
			availableConcerts[concert.ConcertID] = true
		}
		missingConcerts := make([]string, 0)
		for _, concertID := range venueConcertIDs {
			if !availableConcerts[concertID] {
				missingConcerts = append(missingConcerts, concertID)
			}
		}
		if len(missingConcerts) > 0 {
			return fmt.Errorf("venue demo requires existing concerts; missing: %s", strings.Join(missingConcerts, ", "))
		}
		// PostgreSQL timestamp-without-time-zone approval columns are stored as UTC.
		now = now.UTC()
		bangkok := time.FixedZone("Asia/Bangkok", 7*60*60)
		local := now.In(bangkok)
		today := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
		staff := make([]models.User, len(employees))
		for i, spec := range employees {
			code := fmt.Sprintf("TEST-MGMT-%03d", i+1)
			staff[i] = models.User{
				UserID: fmt.Sprintf("%sEMP_%02d", prefix, i+1), FirstName: spec.name, LastName: "ข้อมูลจำลอง",
				DateOfBirth: time.Date(1995, 1, 1, 0, 0, 0, 0, time.UTC), Gender: "ไม่ระบุ",
				PhoneNumber: fmt.Sprintf("000000%04d", i+1), Email: fmt.Sprintf("staff%02d@management-demo.example.test", i+1),
				Address: "[ทดสอบ] บุคคลสมมติ ไม่ใช่ข้อมูลติดต่อจริง", CompanyName: "[ทดสอบ]",
				UserType: "employee", Role: spec.permission, EmployeeCode: &code, Department: spec.department,
				BaseModel: models.BaseModel{CreatedAt: now.AddDate(0, 0, -60), UpdatedAt: now.AddDate(0, 0, -60)},
			}
			if err := create(tx, &staff[i]); err != nil {
				return err
			}
			if err := create(tx, &models.Permission{
				PermissionID: fmt.Sprintf("%sPERM_%02d", prefix, i+1), UserID: staff[i].UserID,
				Position: "employee_management", PermissionName: spec.permission, Scope: spec.scope,
			}); err != nil {
				return err
			}
			if err := create(tx, &models.EmpActivityLogs{
				EmpLogID: fmt.Sprintf("%sSTAFF_CREATE_%02d", prefix, i+1), UserID: &staff[0].UserID,
				ActionType: "สร้าง", TargetID: staff[i].UserID, CreatedAt: staff[i].CreatedAt,
				Description: "[ทดสอบ] สร้างพนักงานจำลอง " + code + " สิทธิ์ " + spec.permission,
			}); err != nil {
				return err
			}
		}
		customers := make([]models.User, 3)
		for i, name := range []string{"ลูกค้าทดสอบเอ", "ลูกค้าทดสอบบี", "ลูกค้าทดสอบซี"} {
			customers[i] = models.User{
				UserID: fmt.Sprintf("%sCUS_%02d", prefix, i+1), FirstName: name, LastName: "ข้อมูลจำลอง",
				DateOfBirth: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), Gender: "ไม่ระบุ",
				PhoneNumber: fmt.Sprintf("000000%04d", i+101), Email: fmt.Sprintf("customer%02d@management-demo.example.test", i+1),
				Address: "[ทดสอบ] บุคคลสมมติ ไม่ใช่ข้อมูลติดต่อจริง", UserType: "customer", Role: "customer",
				BaseModel: models.BaseModel{CreatedAt: now.AddDate(0, 0, -60), UpdatedAt: now.AddDate(0, 0, -60)},
			}
			if err := create(tx, &customers[i]); err != nil {
				return err
			}
		}
		zones := []models.Zone{
			{ZoneID: prefix + "ZONE_VIP", ConcertID: venueConcertIDs[0], ZoneName: "VIP โปรโมชั่น [ทดสอบ]", ZoneType: "VIP [ทดสอบ]", Capacity: 100},
			{ZoneID: prefix + "ZONE_A", ConcertID: venueConcertIDs[0], ZoneName: "โซน A โปรโมชั่น [ทดสอบ]", ZoneType: "โซน A [ทดสอบ]", Capacity: 300},
			{ZoneID: prefix + "ZONE_STANDING", ConcertID: venueConcertIDs[0], ZoneName: "โซนยืน โปรโมชั่น [ทดสอบ]", ZoneType: "ยืน [ทดสอบ]", Capacity: 500},
		}
		for i := range zones {
			if err := create(tx, &zones[i]); err != nil {
				return err
			}
		}
		for i, spec := range promotions {
			if err := seedPromotion(tx, i, spec, concerts[i%len(concerts)].ConcertID, staff, customers, zones, today, now); err != nil {
				return err
			}
		}
		for i, action := range []string{"ติดต่อโฆษณา", "ประสานงาน", "ซื้อบัตรคอนเสิร์ต"} {
			if err := create(tx, &models.CusActivityLogs{
				CusLogID: fmt.Sprintf("%sCUS_OTHER_%02d", prefix, i+1), UserID: customers[i].UserID,
				ActionType: action, Description: "[ทดสอบ] ตัวอย่างประวัติ " + action + " ไม่มีธุรกรรมหรือการติดต่อจริง",
				TargetID: fmt.Sprintf("%sPROMO_%02d", prefix, i+1), CreatedAt: now.Add(-time.Duration(i+1) * time.Hour),
			}); err != nil {
				return err
			}
		}
		// Written last in the SAME transaction; rerunning cannot resurrect deleted demos.
		if err := create(tx, &models.EmpActivityLogs{
			EmpLogID: markerID, ActionType: "สร้าง", CreatedAt: now,
			Description: "[ทดสอบ] ติดตั้งชุดข้อมูลจำลอง 4 เมนู: โปรโมชั่น การอนุมัติ ประวัติ และสิทธิ์พนักงาน (DEMO_MGMT_V1)",
		}); err != nil {
			return err
		}
		if _, err := seedVenueData(tx, now); err != nil {
			return err
		}
		created = true
		return nil
	})
	return created && err == nil, err
}

type venueZoneSpec struct {
	code, name, zoneType, color, shape string
	price, x, y, width, height         float64
}

var venueZones = []venueZoneSpec{
	{code: "VIP", name: "VIP [ทดสอบ]", zoneType: "VIP", color: "#e72d70", shape: "rectangle", price: 3500, x: 32, y: 58, width: 28, height: 34},
	{code: "REGULAR", name: "โซนปกติ [ทดสอบ]", zoneType: "ปกติ", color: "#5d55c6", shape: "circle", price: 1800, x: 68, y: 58, width: 28, height: 34},
}

func seedVenueData(tx *gorm.DB, now time.Time) (bool, error) {
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", venuePrefix).Error; err != nil {
		return false, err
	}
	var markerCount int64
	if err := tx.Model(&models.EmpActivityLogs{}).Where("emp_log_id = ?", venueMarkerID).Count(&markerCount).Error; err != nil {
		return false, err
	}
	if markerCount != 0 {
		return false, nil
	}

	var rows []models.Concert
	if err := tx.Where("concert_id IN ?", venueConcertIDs).Find(&rows).Error; err != nil {
		return false, err
	}
	concerts := make(map[string]models.Concert, len(rows))
	for _, concert := range rows {
		concerts[concert.ConcertID] = concert
	}
	missing := make([]string, 0)
	for _, id := range venueConcertIDs {
		if _, ok := concerts[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		return false, fmt.Errorf("venue demo requires existing concerts; missing: %s", strings.Join(missing, ", "))
	}

	gateTimes := map[string]string{"CC0001": "17:00:00", "CC0002": "18:00:00", "CC0003": "17:30:00"}
	for concertIndex, concertID := range venueConcertIDs {
		concert := concerts[concertID]
		startDate, err := parseSeedDate(concert.StartDate)
		if err != nil {
			return false, fmt.Errorf("concert %s start date: %w", concertID, err)
		}
		endDate, err := parseSeedDate(concert.EndDate)
		if err != nil {
			endDate = startDate
		}
		flowchart, err := makeVenueDemoPNG(concertIndex)
		if err != nil {
			return false, fmt.Errorf("create flowchart for %s: %w", concertID, err)
		}

		layoutObjects, err := json.Marshal([]map[string]any{{
			"id": venuePrefix + concertID + "_STAGE", "kind": "object", "shape": "rectangle",
			"name": "เวที [ทดสอบ]", "color": "#242947", "textColor": "#ffffff",
			"x": 50, "y": 16, "width": 42, "height": 10, "rotation": 0, "z": 1,
		}})
		if err != nil {
			return false, err
		}
		updates := map[string]any{}
		gate := strings.TrimSpace(concert.TimeOpenGate)
		if gate == "" || gate == "00:00:00" {
			updates["time_open_gate"] = gateTimes[concertID]
		}
		layout := strings.TrimSpace(string(concert.LayoutObjects))
		if layout == "" || layout == "[]" || layout == "null" {
			updates["layout_objects"] = models.JSONDocument(layoutObjects)
		}
		if len(updates) > 0 {
			if err := tx.Model(&models.Concert{}).Where("concert_id = ?", concertID).UpdateColumns(updates).Error; err != nil {
				return false, err
			}
		}

		var publicationCount int64
		if err := tx.Model(&models.Publication{}).Where("concert_id = ?", concertID).Count(&publicationCount).Error; err != nil {
			return false, err
		}
		if publicationCount == 0 {
			poster := concert.ConcertPoster
			if len(poster) == 0 {
				poster = concert.Poster
			}
			if len(poster) == 0 {
				poster = flowchart
			}
			openInWeb := startDate.AddDate(0, 0, -45).Add(9 * time.Hour)
			saleOpen := startDate.AddDate(0, 0, -30).Add(10 * time.Hour)
			bookingClose := startDate.Add(17 * time.Hour)
			outWeb := endDate.AddDate(0, 0, 1)
			if err := create(tx, &models.Publication{
				SaleOpenDate: &saleOpen, BookingCloseDatetime: &bookingClose,
				OpenInWeb: &openInWeb, OutWeb: &outWeb, PosterWeb: poster,
				Describtion: "[ทดสอบ] ข้อมูลการเผยแพร่สำหรับ " + concert.ConcertName,
				ConcertID:   concertID, BaseModel: models.BaseModel{CreatedAt: now, UpdatedAt: now},
			}); err != nil {
				return false, err
			}
		}

		for round := 1; round <= 2; round++ {
			scheduleID := fmt.Sprintf("%s%s_SCHEDULE_%02d", venuePrefix, concertID, round)
			var existing models.PerformanceSchedule
			err := tx.First(&existing, "schedule_id = ?", scheduleID).Error
			if err == nil {
				if existing.ConcertID != concertID {
					return false, fmt.Errorf("reserved schedule id %s belongs to concert %s", scheduleID, existing.ConcertID)
				}
				continue
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return false, err
			}
			startShow, endShow := "18:00:00", "20:00:00"
			if round == 2 {
				startShow, endShow = "20:30:00", "22:30:00"
			}
			if err := create(tx, &models.PerformanceSchedule{
				ScheduleID: scheduleID, PerformanceOrder: round,
				Details:   fmt.Sprintf("[ทดสอบ] รอบการแสดงที่ %d", round),
				StartShow: startShow, EndShow: endShow,
				ConcertID: concertID, ShowDate: startDate.Format("2006-01-02"),
			}); err != nil {
				return false, err
			}
		}

		for zoneIndex, spec := range venueZones {
			zoneID := fmt.Sprintf("%s%s_%s", venuePrefix, concertID, spec.code)
			var existing models.Zone
			err := tx.First(&existing, "zone_id = ?", zoneID).Error
			if err == nil {
				if existing.ConcertID != concertID {
					return false, fmt.Errorf("reserved zone id %s belongs to concert %s", zoneID, existing.ConcertID)
				}
				continue
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return false, err
			}
			zone := models.Zone{
				ZoneID: zoneID, ConcertID: concertID, ZoneName: spec.name,
				ZoneType: spec.zoneType, Capacity: 6, Color: spec.color, Shape: spec.shape,
				PositionX: spec.x, PositionY: spec.y, Width: spec.width, Height: spec.height,
				Rotation: 0, LayerOrder: int64(zoneIndex + 2),
			}
			if err := create(tx, &zone); err != nil {
				return false, err
			}
			rowName := string(rune('A' + zoneIndex))
			for seatIndex := 0; seatIndex < 6; seatIndex++ {
				seat := models.Seat{
					SeatRow: rowName, SeatColumn: fmt.Sprint(seatIndex + 1), StatusSeat: "available",
					ConcertID: concertID, ZoneID: zoneID,
					PositionX: float64(20 + (seatIndex%3)*30), PositionY: float64(35 + (seatIndex/3)*30),
					Rotation: 0, Flowchart: flowchart,
				}
				if err := create(tx, &seat); err != nil {
					return false, err
				}
				ticketDateTime := startDate.Add(18 * time.Hour)
				if err := create(tx, &models.Ticket{
					NameConcert: concert.ConcertName, TicketDateTime: ticketDateTime,
					PriceTicket: spec.price, StatusTicket: "available", SeatID: seat.SeatID,
				}); err != nil {
					return false, err
				}
			}
		}
	}

	if err := create(tx, &models.EmpActivityLogs{
		EmpLogID: venueMarkerID, ActionType: "CREATE_VENUE_DEMO", CreatedAt: now,
		Description: "[ทดสอบ] ติดตั้งข้อมูลจำลอง Publication, PerformanceSchedule, Zone, Seat และ Ticket สำหรับ CC0001-CC0003 (DEMO_VENUE_V1)",
	}); err != nil {
		return false, err
	}
	return true, nil
}

func parseSeedDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	if len(value) >= 10 {
		value = value[:10]
	}
	return time.Parse("2006-01-02", value)
}

func makeVenueDemoPNG(index int) ([]byte, error) {
	palettes := [][2]color.RGBA{
		{{R: 231, G: 45, B: 112, A: 255}, {R: 93, G: 85, B: 198, A: 255}},
		{{R: 31, G: 154, B: 175, A: 255}, {R: 244, G: 162, B: 97, A: 255}},
		{{R: 123, G: 44, B: 191, A: 255}, {R: 46, G: 196, B: 182, A: 255}},
	}
	palette := palettes[index%len(palettes)]
	canvas := image.NewRGBA(image.Rect(0, 0, 1200, 700))
	draw.Draw(canvas, canvas.Bounds(), &image.Uniform{C: color.RGBA{R: 248, G: 248, B: 252, A: 255}}, image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(350, 55, 850, 140), &image.Uniform{C: color.RGBA{R: 36, G: 41, B: 71, A: 255}}, image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(140, 250, 520, 590), &image.Uniform{C: palette[0]}, image.Point{}, draw.Src)
	draw.Draw(canvas, image.Rect(680, 250, 1060, 590), &image.Uniform{C: palette[1]}, image.Point{}, draw.Src)
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func seedPromotion(tx *gorm.DB, index int, spec promotionSpec, concertID string, staff, customers []models.User, zones []models.Zone, today, now time.Time) error {
	id := fmt.Sprintf("%sPROMO_%02d", prefix, index+1)
	start, end := today.AddDate(0, 0, -7), today.AddDate(0, 0, 30)
	createdAt := start.AddDate(0, 0, -3)
	if spec.status == "expired" {
		start, end = today.AddDate(0, 0, -45), today.AddDate(0, 0, -15)
		createdAt = start.AddDate(0, 0, -3)
	} else if spec.status == "draft" {
		start, end = today.AddDate(0, 0, 1), today.AddDate(0, 0, 45)
		createdAt = now.Add(-time.Duration(index+6) * time.Hour)
	}
	logs := make([]models.PromotionUsageLog, spec.used)
	var revenue float64
	for i := range logs {
		customer, zone := customers[i%len(customers)], zones[i%len(zones)]
		price := float64(2000 + (i%3)*500)
		discount := spec.value
		if spec.discountType == "percent" {
			discount = price * spec.value / 100
			if spec.cap > 0 && discount > spec.cap {
				discount = spec.cap
			}
		}
		logs[i] = models.PromotionUsageLog{
			UsageLogID: fmt.Sprintf("%sUSE_%02d_%02d", prefix, index+1, i+1), PromotionID: id,
			UsedAt: start.AddDate(0, 0, 1+i%5).Add(time.Duration(8+i/5) * time.Hour),
			UserID: customer.UserID, UserName: customer.FirstName + " " + customer.LastName,
			OrderID: fmt.Sprintf("TEST-MGMT-ORDER-%02d-%02d", index+1, i+1), PurchasedZone: zone.ZoneType,
			FinalAmount: price - discount, DiscountAmount: discount,
		}
		revenue += logs[i].FinalAmount
	}
	promotion := models.Promotion{
		PromotionID: id, PromotionName: "[ทดสอบ] " + spec.name, ConcertID: concertID,
		Description:    "[ทดสอบ] ข้อมูลจำลองสำหรับทดลองรายการ รายละเอียด การแก้ไข และการอนุมัติ ไม่ใช่แคมเปญจริง",
		BannerImageUrl: []byte{}, Status: spec.status, ZoneType: "multiple", TotalRevenue: revenue,
		CreatedAt: createdAt, UpdatedAt: createdAt.Add(2 * time.Hour),
	}
	// The application reserves promo codes case-insensitively, including archived records.
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended('management-promo-code:' || UPPER(BTRIM(CAST(? AS text))), 0))", spec.code).Error; err != nil {
		return err
	}
	var duplicate int64
	if err := tx.Model(&models.DiscountInfo{}).Where("UPPER(BTRIM(promo_code)) = UPPER(BTRIM(CAST(? AS text)))", spec.code).Count(&duplicate).Error; err != nil {
		return err
	}
	if duplicate != 0 {
		return fmt.Errorf("demo promo code %s is already used; refusing to overwrite it", spec.code)
	}
	for _, row := range []any{
		&promotion,
		&models.DiscountInfo{DiscountID: fmt.Sprintf("%sDISCOUNT_%02d", prefix, index+1), PromotionID: id, DiscountType: spec.discountType, DiscountValue: spec.value, MinOrderValue: 1000, MaxDiscountAmount: spec.cap, PromoCode: spec.code},
		&models.Quota{QuotaID: fmt.Sprintf("%sQUOTA_%02d", prefix, index+1), PromotionID: id, StartDate: start, EndDate: end, TicketQuota: 200, UsedQuota: spec.used},
		&models.PromoCondition{ConditionID: fmt.Sprintf("%sCONDITION_%02d", prefix, index+1), PromotionID: id, MaxUsagePerUser: 5, ConditionDetail: "[ทดสอบ] ใช้ได้ทุกโซนที่เลือก ยอดขั้นต่ำ 1,000 บาท จำกัด 5 ครั้งต่อคน ไม่สามารถใช้ร่วมกับส่วนลดอื่น ข้อมูลนี้ใช้ทดสอบเท่านั้น"},
	} {
		if err := create(tx, row); err != nil {
			return err
		}
	}
	if err := tx.Model(&promotion).Omit("Zones.*").Association("Zones").Append(zones); err != nil {
		return err
	}
	requester, approver := staff[2], staff[0]
	approval := models.PromotionApproval{
		ApprovalID: fmt.Sprintf("%sAPPROVAL_%02d", prefix, index+1), PromotionID: id,
		RequestedBy: requester.FirstName + " " + requester.LastName, RequestedAt: createdAt.Add(time.Hour),
		StatusApproved: spec.approval, Remark: "[ทดสอบ] รอพิจารณา สามารถทดลองอนุมัติหรือปฏิเสธได้",
	}
	if spec.approval != "pending" {
		decidedAt := createdAt.Add(2 * time.Hour)
		approval.ApprovedAt, approval.UserID = &decidedAt, &approver.UserID
		approval.ApprovedBy = approver.FirstName + " " + approver.LastName
		approval.Remark = "[ทดสอบ] อนุมัติข้อมูลจำลองสำหรับทดสอบการแสดงผล"
		if spec.approval == "rejected" {
			approval.Remark = "[ทดสอบ] ส่วนลดเกินงบตัวอย่าง กรุณาปรับมูลค่าและส่งอนุมัติใหม่"
		}
		action := "APPROVE_PROMOTION"
		if spec.approval == "rejected" {
			action = "REJECT_PROMOTION"
		}
		if err := create(tx, &models.EmpActivityLogs{
			EmpLogID: fmt.Sprintf("%sDECIDE_%02d", prefix, index+1), UserID: &approver.UserID,
			ActionType: action, TargetID: id, CreatedAt: decidedAt, Description: approval.Remark + " — " + promotion.PromotionName,
		}); err != nil {
			return err
		}
	}
	if err := create(tx, &approval); err != nil {
		return err
	}
	if err := create(tx, &models.EmpActivityLogs{
		EmpLogID: fmt.Sprintf("%sCREATE_%02d", prefix, index+1), UserID: &requester.UserID,
		ActionType: "CREATE_PROMOTION", TargetID: id, CreatedAt: createdAt, Description: "สร้างโปรโมชั่น " + promotion.PromotionName,
	}); err != nil {
		return err
	}
	for i := range logs {
		if err := create(tx, &logs[i]); err != nil {
			return err
		}
		if err := create(tx, &models.CusActivityLogs{
			CusLogID: fmt.Sprintf("%sCUS_USE_%02d_%02d", prefix, index+1, i+1), UserID: logs[i].UserID,
			ActionType: "ซื้อบัตร", TargetID: id, CreatedAt: logs[i].UsedAt,
			Description: "[ทดสอบ] จำลองใช้รหัส " + spec.code + " เลขรายการ " + logs[i].OrderID + " ไม่มีการจองหรือชำระเงินจริง",
		}); err != nil {
			return err
		}
	}
	return nil
}
