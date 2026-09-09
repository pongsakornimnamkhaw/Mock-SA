package main

import (
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
	values, err := godotenv.Read("../../.env")
	if err != nil {
		t.Fatal(err)
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", values["DB_HOST"], values["DB_PORT"], values["DB_USER"], values["DB_PASSWORD"], values["DB_NAME"], values["DB_SSLMODE"])
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
		t.Fatal("seed must refuse a database without an existing concert")
	}
	count(&models.User{}, 0)
	concert := models.Concert{ConcertID: "EXISTING_CONCERT", ConcertName: "Existing untouched concert", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "Test", Status: "ยืนยันแล้ว"}
	must(create(db, &concert))
	// Compare the stored value, after PostgreSQL's microsecond timestamp rounding.
	must(db.First(&concert, "concert_id = ?", concert.ConcertID).Error)
	// Force a collision AFTER user inserts: the entire transaction must roll back.
	zone := models.Zone{ZoneID: prefix + "ZONE_VIP", ConcertID: concert.ConcertID, ZoneType: "Existing zone", Capacity: 10}
	must(create(db, &zone))
	if created, err := seed(db, now); err == nil || created {
		t.Fatal("seed must fail atomically on an existing ID, not upsert it")
	}
	count(&models.User{}, 0)
	count(&models.EmpActivityLogs{}, 0)
	count(&models.Zone{}, 1)
	must(db.Delete(&zone).Error)
	created, err := seed(db, now)
	must(err)
	if !created {
		t.Fatal("first successful run must install fixtures")
	}
	count(&models.User{}, 11)
	count(&models.Permission{}, 8)
	count(&models.Promotion{}, 10)
	count(&models.PromotionApproval{}, 10)
	count(&models.Zone{}, 3)
	count(&models.PromotionUsageLog{}, 27)
	count(&models.EmpActivityLogs{}, 26)
	count(&models.CusActivityLogs{}, 30)
	count(&models.Booking{}, 0)
	count(&models.Payment{}, 0)
	var items []models.Promotion
	must(db.Preload("UsageLogs").Preload("Quotas").Preload("Zones").Preload("PromotionApprovals").Find(&items).Error)
	for _, p := range items {
		if len(p.Quotas) != 1 || len(p.Zones) != 3 || len(p.PromotionApprovals) != 1 {
			t.Fatalf("missing promotion relations: %s", p.PromotionID)
		}
		var total float64
		for _, log := range p.UsageLogs {
			total += log.FinalAmount
			if log.UsedAt.After(now) || log.UsedAt.Before(p.Quotas[0].StartDate) || log.UsedAt.After(p.Quotas[0].EndDate.Add(24*time.Hour)) {
				t.Fatalf("invalid redemption time: %s", log.UsageLogID)
			}
		}
		if total != p.TotalRevenue || len(p.UsageLogs) != p.Quotas[0].UsedQuota {
			t.Fatalf("inconsistent summary: %s", p.PromotionID)
		}
		approval := p.PromotionApprovals[0]
		if approval.RequestedAt.After(now) || (approval.ApprovedAt != nil && (approval.ApprovedAt.After(now) || approval.ApprovedAt.Before(approval.RequestedAt))) {
			t.Fatal("invalid approval timestamps")
		}
	}
	// A rerun must not reset decisions, employee edits or soft-deleted promotions.
	must(db.Model(&models.PromotionApproval{}).Where("approval_id = ?", prefix+"APPROVAL_06").Update("remark", "User edited during test").Error)
	must(db.Model(&models.User{}).Where("user_id = ?", prefix+"EMP_01").Update("department", "User edited department").Error)
	must(db.Where("promotion_id = ?", prefix+"PROMO_01").Delete(&models.Promotion{}).Error)
	created, err = seed(db, now.AddDate(0, 1, 0))
	must(err)
	if created {
		t.Fatal("rerun must not insert data")
	}
	count(&models.Promotion{}, 9)
	count(&models.User{}, 11)
	count(&models.EmpActivityLogs{}, 26)
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
	var reread models.Concert
	must(db.First(&reread, "concert_id = ?", concert.ConcertID).Error)
	if reread.ConcertName != concert.ConcertName || !reread.UpdatedAt.Equal(concert.UpdatedAt) {
		t.Fatal("seed changed an existing concert")
	}
}
