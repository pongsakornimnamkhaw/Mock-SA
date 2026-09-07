// seed-customer-demo installs an explicitly labelled customer account and
// ticket history for local UI testing. It never overwrites or deletes data.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"

	"backend/internal/config"
	"backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

const (
	demoPrefix   = "DEMO_CUSTOMER_V1_"
	demoUserID   = demoPrefix + "USER"
	demoEmail    = "customer.demo@octavia.test"
	demoPassword = "Demo1234!"
)

type concertReference struct {
	ConcertID   string
	ConcertName string
}

type demoBookingSpec struct {
	zoneName      string
	price         float64
	ageDays       int
	bookingStatus string
	paymentStatus string
	ticketStatus  string
	ticketCount   int
}

var demoBookings = []demoBookingSpec{
	{zoneName: "VIP [ทดสอบ]", price: 3500, ageDays: 60, bookingStatus: "สำเร็จ", paymentStatus: "ชำระเงินแล้ว", ticketStatus: "ใช้งานแล้ว", ticketCount: 2},
	{zoneName: "โซน A [ทดสอบ]", price: 2500, ageDays: 7, bookingStatus: "สำเร็จ", paymentStatus: "ชำระเงินแล้ว", ticketStatus: "พร้อมใช้งาน", ticketCount: 2},
	{zoneName: "โซน B [ทดสอบ]", price: 1800, ageDays: 1, bookingStatus: "ยกเลิก", paymentStatus: "คืนเงินแล้ว", ticketStatus: "ยกเลิก", ticketCount: 1},
}

func main() {
	apply := flag.Bool("apply", false, "Insert the customer demo dataset into the database configured in backend/.env")
	flag.Parse()
	if !*apply {
		printPreview()
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
	created, err := seedCustomerDemo(db.WithContext(ctx), time.Now())
	if err != nil {
		fmt.Fprintln(os.Stderr, "Customer demo seed failed; all inserts rolled back:", err)
		os.Exit(1)
	}
	if !created {
		fmt.Println("Customer demo dataset is already installed. Existing test changes were preserved.")
		printCredentials()
		return
	}

	fmt.Println("Created: 1 demo customer, 1 promotion placeholder, 3 bookings, 3 payments and 5 tickets.")
	fmt.Println("All demo IDs start with " + demoPrefix + "; existing records were not changed.")
	printCredentials()
}

func printPreview() {
	fmt.Println("Preview: 1 demo customer, 1 promotion placeholder, 3 bookings, 3 payments and 5 tickets for customer-side UI testing.")
	fmt.Println("Run from backend: go run ./cmd/seed-customer-demo --apply")
	fmt.Println("Development data only. Existing records are never updated or deleted.")
	printCredentials()
}

func printCredentials() {
	fmt.Println("Demo login: " + demoEmail)
	fmt.Println("Demo password: " + demoPassword)
}

func createDemoRow(tx *gorm.DB, row any) error {
	return tx.Omit(clause.Associations).Create(row).Error
}

func seedCustomerDemo(db *gorm.DB, now time.Time) (bool, error) {
	created := false
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", demoPrefix).Error; err != nil {
			return err
		}

		var existing models.User
		err := tx.First(&existing, "user_id = ?", demoUserID).Error
		if err == nil {
			if existing.Email != demoEmail {
				return fmt.Errorf("demo user ID is occupied by a different email")
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var emailCount int64
		if err := tx.Model(&models.User{}).Where("LOWER(email) = ?", demoEmail).Count(&emailCount).Error; err != nil {
			return err
		}
		if emailCount != 0 {
			return fmt.Errorf("demo email %s is already used; refusing to overwrite it", demoEmail)
		}

		var concerts []concertReference
		if err := tx.Model(&models.Concert{}).
			Select("concert_id, concert_name").Order("concert_id").Limit(len(demoBookings)).Scan(&concerts).Error; err != nil {
			return err
		}
		if len(concerts) == 0 {
			return fmt.Errorf("at least one existing concert is required")
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(demoPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		user := models.User{
			UserID: demoUserID, FirstName: "สมชาย", LastName: "ผู้ทดสอบ",
			DateOfBirth: time.Date(1995, 5, 15, 0, 0, 0, 0, time.UTC), Gender: "ชาย",
			PhoneNumber: "0000000201", Email: demoEmail, PasswordHash: string(passwordHash),
			Address: "[ทดสอบ] กรุงเทพมหานคร ไม่ใช่ข้อมูลติดต่อจริง", UserType: "customer", Role: "customer",
			BaseModel: models.BaseModel{CreatedAt: now.UTC().AddDate(0, -3, 0), UpdatedAt: now.UTC().AddDate(0, -3, 0)},
		}
		if err := createDemoRow(tx, &user); err != nil {
			return err
		}

		// dummy Promotion ที่ TicketCategory ต้องอ้างอิง (FK: fk_promotions_ticket_categories)
		demoConcert := concerts[0]
		demoPromotionID := demoPrefix + "PROMOTION"
		if err := createDemoRow(tx, &models.Promotion{
			PromotionID:    demoPromotionID,
			PromotionName:  "[ทดสอบ] ไม่มีโปรโมชั่น",
			Description:    "[ทดสอบ] placeholder สำหรับ TicketCategory ที่ไม่มีโปรโมชั่น",
			BannerImageUrl: []byte{},
			Status:         "archived",
			ZoneType:       "ทดสอบ",
			TotalRevenue:   0,
			ConcertID:      demoConcert.ConcertID,
		}); err != nil {
			return err
		}

		for bookingIndex, spec := range demoBookings {
			sequence := bookingIndex + 1
			concert := concerts[bookingIndex%len(concerts)]
			zoneID := fmt.Sprintf("%sZONE_%02d", demoPrefix, sequence)
			zone := models.Zone{ZoneID: zoneID, ZoneType: spec.zoneName, Capacity: 100}
			if err := createDemoRow(tx, &zone); err != nil {
				return err
			}
			if err := createDemoRow(tx, &models.TicketCategory{
				CategoryID:   fmt.Sprintf("%sCATEGORY_%02d", demoPrefix, sequence),
				CategoryName: spec.zoneName, Price: spec.price, Quantity: 100,
				PromotionName: "ไม่มีโปรโมชั่น", PromotionID: demoPromotionID, ZoneID: zoneID,
			}); err != nil {
				return err
			}

			bookingID := fmt.Sprintf("%sBOOKING_%02d", demoPrefix, sequence)
			bookingDate := now.UTC().AddDate(0, 0, -spec.ageDays)
			if err := createDemoRow(tx, &models.Booking{
				BookingID: bookingID, BookingDate: bookingDate, Status: spec.bookingStatus, UserID: &user.UserID,
			}); err != nil {
				return err
			}
			if err := createDemoRow(tx, &models.Payment{
				PaymentID: fmt.Sprintf("%sPAYMENT_%02d", demoPrefix, sequence), EvidenceFile: []byte{},
				PaymentStatus: spec.paymentStatus, BookingID: bookingID,
			}); err != nil {
				return err
			}

			for ticketIndex := 0; ticketIndex < spec.ticketCount; ticketIndex++ {
				seatID := fmt.Sprintf("%sSEAT_%02d_%02d", demoPrefix, sequence, ticketIndex+1)
				if err := createDemoRow(tx, &models.Seat{
					SeatID: seatID, SeatRow: sequence, SeatColumn: ticketIndex + 1,
					StatusSeat: "ไม่ว่าง", ConcertID: concert.ConcertID, ZoneID: zoneID,
				}); err != nil {
					return err
				}
				if err := createDemoRow(tx, &models.Ticket{
					TicketID:    fmt.Sprintf("%sTICKET_%02d_%02d", demoPrefix, sequence, ticketIndex+1),
					NameConcert: concert.ConcertName, TicketDateTime: bookingDate.Add(time.Duration(ticketIndex+10) * time.Minute),
					StatusTicket: spec.ticketStatus, SeatID: seatID, BookingID: bookingID,
				}); err != nil {
					return err
				}
			}
		}

		if err := createDemoRow(tx, &models.CusActivityLogs{
			CusLogID: demoPrefix + "ACTIVITY", UserID: user.UserID, ActionType: "สร้างข้อมูลทดสอบ",
			Description: "[ทดสอบ] บัญชีลูกค้าสำหรับทดลองหน้าบัตร ประวัติการซื้อ และโปรไฟล์",
			TargetID:    user.UserID, CreatedAt: now.UTC(),
		}); err != nil {
			return err
		}

		created = true
		return nil
	})
	return created && err == nil, err
}
