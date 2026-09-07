package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Only a unique, disposable schema is migrated/mutated by this opt-in test.
func TestSeedManagementPostgres(t *testing.T) {
	if os.Getenv("MANAGEMENT_SEED_TEST") != "1" {
		t.Skip("set MANAGEMENT_SEED_TEST=1 for isolated PostgreSQL seed verification")
	}
	values, _ := godotenv.Read("../../.env")
	setting := func(key string) string {
		if value := os.Getenv(key); value != "" {
			return value
		}
		return values[key]
	}
	for _, key := range []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"} {
		if setting(key) == "" {
			t.Fatalf("missing PostgreSQL test setting %s", key)
		}
	}
	sslMode := setting("DB_SSLMODE")
	if sslMode == "" {
		sslMode = "disable"
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", setting("DB_HOST"), setting("DB_PORT"), setting("DB_USER"), setting("DB_PASSWORD"), setting("DB_NAME"), sslMode)
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "management_seed_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := admin.Exec(`CREATE SCHEMA "` + schema + `"`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if strings.HasPrefix(schema, "management_seed_test_") && len(schema) == 53 {
			if err := admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`).Error; err != nil {
				t.Error(err)
			}
		} else {
			t.Error("refusing unsafe schema cleanup")
		}
		if connection, err := admin.DB(); err == nil {
			connection.Close()
		}
	})
	db, err := gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if connection, err := db.DB(); err == nil {
			connection.Close()
		}
	})
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	count := func(model any, expected int64) {
		t.Helper()
		var actual int64
		must(db.Model(model).Count(&actual).Error)
		if actual != expected {
			t.Fatalf("%T count: got %d, want %d", model, actual, expected)
		}
	}

	must(models.MigrateAllModels(db))
	now := time.Date(2026, 9, 4, 1, 30, 0, 0, time.FixedZone("Bangkok", 7*60*60))
	if created, err := seed(db, now); err == nil || created {
		t.Fatal("seed must refuse a database without CC0001-CC0003")
	}
	count(&models.User{}, 0)

	concerts := []models.Concert{
		{
			ConcertID: "CC0001", ConcertName: "Acoustic Sessions: Bangkok", StartDate: "2027-01-16", EndDate: "2027-01-18",
			StartTime: "18:00:00", EndTime: "22:30:00", TimeOpenGate: "15:30:00", Location: "Lido Connect", Status: "ยืนยันแล้ว",
			MoreInfo: "existing CC0001", LayoutObjects: models.JSONDocument(`[{"id":"USER_STAGE"}]`),
		},
		{
			ConcertID: "CC0002", ConcertName: "Neon Nights Vol.3", StartDate: "2027-05-16", EndDate: "2027-05-18",
			StartTime: "19:00:00", EndTime: "23:00:00", Location: "MCC Hall", Status: "เลื่อนการจัด", MoreInfo: "existing CC0002",
			ConcertPoster: []byte("existing-concert-poster"),
		},
		{
			ConcertID: "CC0003", ConcertName: "Riverside Sound Festival", StartDate: "2027-10-16", EndDate: "2027-10-18",
			StartTime: "18:30:00", EndTime: "22:30:00", Location: "ริมแม่น้ำ", Status: "ยืนยันแล้ว", MoreInfo: "existing CC0003",
		},
	}
	must(create(db, &concerts[0]))
	// A partial set must roll back management fixtures and report the missing IDs.
	if created, err := seed(db, now); err == nil || created || !strings.Contains(err.Error(), "CC0002, CC0003") {
		t.Fatalf("seed must report missing venue concerts, got created=%v err=%v", created, err)
	}
	count(&models.User{}, 0)
	count(&models.EmpActivityLogs{}, 0)
	must(create(db, &concerts[1]))
	must(create(db, &concerts[2]))

	existingPublication := models.Publication{
		ConcertID: "CC0001", Describtion: "user publication must stay unchanged", PosterWeb: []byte("user-poster"),
		BaseModel: models.BaseModel{CreatedAt: now.AddDate(0, -1, 0), UpdatedAt: now.AddDate(0, -1, 0)},
	}
	must(create(db, &existingPublication))
	existingSchedule := models.PerformanceSchedule{
		ScheduleID: "USER_CC0001_SCHEDULE", PerformanceOrder: 99, Details: "user schedule",
		StartShow: "12:00:00", EndShow: "13:00:00", ConcertID: "CC0001", ShowDate: "2027-01-17",
	}
	must(create(db, &existingSchedule))
	// Compare the stored value after PostgreSQL's timestamp/JSON normalization.
	must(db.First(&concerts[0], "concert_id = ?", concerts[0].ConcertID).Error)

	// An installation that already has the old management marker must still receive venue fixtures.
	rollbackProbe := errors.New("rollback marker-upgrade probe")
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := create(tx, &models.EmpActivityLogs{EmpLogID: markerID, ActionType: "TEST", CreatedAt: now, Description: "old marker probe"}); err != nil {
			return err
		}
		created, err := seed(tx, now)
		if err != nil {
			return err
		}
		if !created {
			return errors.New("venue fixtures were not added beside the old management marker")
		}
		var markerCount, seatCount int64
		if err := tx.Model(&models.EmpActivityLogs{}).Where("emp_log_id = ?", venueMarkerID).Count(&markerCount).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Seat{}).Count(&seatCount).Error; err != nil {
			return err
		}
		if markerCount != 1 || seatCount != 36 {
			return fmt.Errorf("marker upgrade created marker=%d seats=%d", markerCount, seatCount)
		}
		return rollbackProbe
	})
	if !errors.Is(err, rollbackProbe) {
		t.Fatalf("old-marker upgrade probe failed: %v", err)
	}
	count(&models.EmpActivityLogs{}, 0)
	count(&models.Seat{}, 0)

	// Force a collision after management user inserts: the entire transaction must roll back.
	managementCollision := models.Zone{ZoneID: prefix + "ZONE_VIP", ConcertID: "CC0001", ZoneName: "Existing zone", ZoneType: "Existing zone", Capacity: 10}
	must(create(db, &managementCollision))
	if created, err := seed(db, now); err == nil || created {
		t.Fatal("seed must fail atomically on an existing management ID")
	}
	count(&models.User{}, 0)
	count(&models.EmpActivityLogs{}, 0)
	count(&models.Zone{}, 1)
	must(db.Delete(&managementCollision).Error)

	// A reserved venue ID may never be silently moved to another concert.
	venueCollision := models.Zone{
		ZoneID: venuePrefix + "CC0001_VIP", ConcertID: "CC0002", ZoneName: "collision",
		ZoneType: "existing", Capacity: 1, Color: "#000000", Shape: "rectangle", Width: 10, Height: 10,
	}
	must(create(db, &venueCollision))
	if created, err := seed(db, now); err == nil || created || !strings.Contains(err.Error(), "belongs to concert CC0002") {
		t.Fatalf("seed must roll back a cross-concert reserved ID collision, got created=%v err=%v", created, err)
	}
	count(&models.User{}, 0)
	count(&models.EmpActivityLogs{}, 0)
	count(&models.Zone{}, 1)
	must(db.Delete(&venueCollision).Error)

	created, err := seed(db, now)
	must(err)
	if !created {
		t.Fatal("first successful run must install fixtures")
	}
	count(&models.User{}, 11)
	count(&models.Permission{}, 8)
	count(&models.Promotion{}, 10)
	count(&models.PromotionApproval{}, 10)
	count(&models.Publication{}, 3)
	count(&models.PerformanceSchedule{}, 7)
	count(&models.Zone{}, 9)
	count(&models.Seat{}, 36)
	count(&models.Ticket{}, 36)
	count(&models.PromotionUsageLog{}, 27)
	count(&models.EmpActivityLogs{}, 27)
	count(&models.CusActivityLogs{}, 30)
	count(&models.Booking{}, 0)
	count(&models.Payment{}, 0)
	count(&models.GateCheckIn{}, 0)
	count(&models.TicketCategory{}, 0)

	var storedPublication models.Publication
	must(db.First(&storedPublication, "concert_id = ?", "CC0001").Error)
	if storedPublication.Describtion != existingPublication.Describtion || !bytes.Equal(storedPublication.PosterWeb, existingPublication.PosterWeb) {
		t.Fatal("seed overwrote an existing publication")
	}
	storedPublication = models.Publication{}
	must(db.First(&storedPublication, "concert_id = ?", "CC0002").Error)
	if !bytes.Equal(storedPublication.PosterWeb, concerts[1].ConcertPoster) {
		t.Fatal("publication did not reuse the existing concert poster")
	}
	storedPublication = models.Publication{}
	must(db.First(&storedPublication, "concert_id = ?", "CC0003").Error)
	if len(storedPublication.PosterWeb) < 8 || !bytes.Equal(storedPublication.PosterWeb[:8], []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatal("publication fallback poster is not a PNG")
	}

	for _, concertID := range venueConcertIDs {
		var demoScheduleCount int64
		must(db.Model(&models.PerformanceSchedule{}).
			Where("concert_id = ? AND schedule_id LIKE ?", concertID, venuePrefix+concertID+"\\_SCHEDULE\\_%").
			Count(&demoScheduleCount).Error)
		if demoScheduleCount != 2 {
			t.Fatalf("%s demo schedule count: got %d, want 2", concertID, demoScheduleCount)
		}

		var seats []models.Seat
		must(db.Where("concert_id = ?", concertID).Order("seat_id").Find(&seats).Error)
		if len(seats) != 12 {
			t.Fatalf("%s seat count: got %d, want 12", concertID, len(seats))
		}
		for _, seat := range seats {
			if len(seat.Flowchart) == 0 || !bytes.Equal(seat.Flowchart, seats[0].Flowchart) {
				t.Fatalf("%s seats do not contain the same flowchart bytes", concertID)
			}
			var ticket models.Ticket
			must(db.First(&ticket, "seat_id = ?", seat.SeatID).Error)
			expectedPrice := 1800.0
			if strings.HasSuffix(seat.ZoneID, "_VIP") {
				expectedPrice = 3500
			}
			if ticket.PriceTicket != expectedPrice || ticket.BookingID != nil || ticket.CategoryID != nil || ticket.GateID != nil {
				t.Fatalf("invalid ticket for seat %d: %+v", seat.SeatID, ticket)
			}
		}
	}
	var uniqueTicketSeats int64
	must(db.Model(&models.Ticket{}).Distinct("seat_id").Count(&uniqueTicketSeats).Error)
	if uniqueTicketSeats != 36 {
		t.Fatalf("unique ticket seat count: got %d, want 36", uniqueTicketSeats)
	}

	var preservedConcert models.Concert
	must(db.First(&preservedConcert, "concert_id = ?", "CC0001").Error)
	if preservedConcert.TimeOpenGate != "15:30:00" || string(preservedConcert.LayoutObjects) != string(concerts[0].LayoutObjects) {
		t.Fatal("seed overwrote non-empty concert venue fields")
	}
	for _, concertID := range []string{"CC0002", "CC0003"} {
		var concert models.Concert
		must(db.First(&concert, "concert_id = ?", concertID).Error)
		if concert.TimeOpenGate == "" || concert.TimeOpenGate == "00:00:00" || len(concert.LayoutObjects) == 0 || string(concert.LayoutObjects) == "[]" || !json.Valid(concert.LayoutObjects) {
			t.Fatalf("seed did not fill empty venue fields for %s", concertID)
		}
	}

	var items []models.Promotion
	must(db.Preload("UsageLogs").Preload("Quotas").Preload("Zones").Preload("PromotionApprovals").Find(&items).Error)
	for _, promotion := range items {
		if len(promotion.Quotas) != 1 || len(promotion.Zones) != 3 || len(promotion.PromotionApprovals) != 1 {
			t.Fatalf("missing promotion relations: %s", promotion.PromotionID)
		}
		var total float64
		for _, log := range promotion.UsageLogs {
			total += log.FinalAmount
			if log.UsedAt.After(now) || log.UsedAt.Before(promotion.Quotas[0].StartDate) || log.UsedAt.After(promotion.Quotas[0].EndDate.Add(24*time.Hour)) {
				t.Fatalf("invalid redemption time: %s", log.UsageLogID)
			}
		}
		if total != promotion.TotalRevenue || len(promotion.UsageLogs) != promotion.Quotas[0].UsedQuota {
			t.Fatalf("inconsistent summary: %s", promotion.PromotionID)
		}
		approval := promotion.PromotionApprovals[0]
		if approval.RequestedAt.After(now) || (approval.ApprovedAt != nil && (approval.ApprovedAt.After(now) || approval.ApprovedAt.Before(approval.RequestedAt))) {
			t.Fatal("invalid approval timestamps")
		}
	}

	// A rerun must not reset management decisions, publication edits, zone edits or soft-deleted promotions.
	must(db.Model(&models.PromotionApproval{}).Where("approval_id = ?", prefix+"APPROVAL_06").Update("remark", "User edited during test").Error)
	must(db.Model(&models.User{}).Where("user_id = ?", prefix+"EMP_01").Update("department", "User edited department").Error)
	must(db.Model(&models.Publication{}).Where("concert_id = ?", "CC0002").Update("describtion", "User edited publication").Error)
	must(db.Model(&models.Zone{}).Where("zone_id = ?", venuePrefix+"CC0002_VIP").Update("zone_name", "User edited zone").Error)
	must(db.Where("promotion_id = ?", prefix+"PROMO_01").Delete(&models.Promotion{}).Error)
	created, err = seed(db, now.AddDate(0, 1, 0))
	must(err)
	if created {
		t.Fatal("rerun must not insert data")
	}
	count(&models.Promotion{}, 9)
	count(&models.User{}, 11)
	count(&models.Publication{}, 3)
	count(&models.PerformanceSchedule{}, 7)
	count(&models.Zone{}, 9)
	count(&models.Seat{}, 36)
	count(&models.Ticket{}, 36)
	count(&models.EmpActivityLogs{}, 27)
	var approval models.PromotionApproval
	must(db.First(&approval, "approval_id = ?", prefix+"APPROVAL_06").Error)
	if approval.Remark != "User edited during test" {
		t.Fatal("rerun overwrote approval edit")
	}
	var employee models.User
	must(db.First(&employee, "user_id = ?", prefix+"EMP_01").Error)
	if employee.Department != "User edited department" {
		t.Fatal("rerun overwrote employee edit")
	}
	storedPublication = models.Publication{}
	must(db.First(&storedPublication, "concert_id = ?", "CC0002").Error)
	if storedPublication.Describtion != "User edited publication" {
		t.Fatal("rerun overwrote publication edit")
	}
	var editedZone models.Zone
	must(db.First(&editedZone, "zone_id = ?", venuePrefix+"CC0002_VIP").Error)
	if editedZone.ZoneName != "User edited zone" {
		t.Fatal("rerun overwrote zone edit")
	}
	must(db.First(&preservedConcert, "concert_id = ?", concerts[0].ConcertID).Error)
	if preservedConcert.ConcertName != concerts[0].ConcertName || !preservedConcert.UpdatedAt.Equal(concerts[0].UpdatedAt) {
		t.Fatal("seed changed protected values on an existing concert")
	}
}
