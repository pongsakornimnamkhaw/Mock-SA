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
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestSeedCustomerDemoPostgres(t *testing.T) {
	if os.Getenv("CUSTOMER_DEMO_SEED_TEST") != "1" {
		t.Skip("set CUSTOMER_DEMO_SEED_TEST=1 for isolated PostgreSQL seed verification")
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
	schema := "customer_demo_seed_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := admin.Exec(`CREATE SCHEMA "` + schema + `"`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if strings.HasPrefix(schema, "customer_demo_seed_test_") && len(schema) == 56 {
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
	if err := models.MigrateAllModels(db); err != nil {
		t.Fatal(err)
	}
	concert := models.Concert{ConcertID: "DEMO_CONCERT", ConcertName: "คอนเสิร์ตทดสอบ", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "สถานที่ทดสอบ", Status: "ยืนยันแล้ว", MoreInfo: "ข้อมูลทดสอบ"}
	if err := createDemoRow(db, &concert); err != nil {
		t.Fatal(err)
	}

	now := time.Date(2026, 9, 4, 8, 0, 0, 0, time.UTC)
	created, err := seedCustomerDemo(db, now)
	if err != nil || !created {
		t.Fatalf("seed failed: created=%v err=%v", created, err)
	}
	for model, expected := range map[any]int64{
		&models.User{}: 1, &models.Booking{}: 3, &models.Payment{}: 3,
		&models.Ticket{}: 5, &models.Seat{}: 5, &models.Zone{}: 3,
		&models.TicketCategory{}: 3, &models.CusActivityLogs{}: 1,
		&models.Promotion{}: 1,
	} {
		var actual int64
		if err := db.Model(model).Count(&actual).Error; err != nil || actual != expected {
			t.Fatalf("%T count: got %d, want %d (err=%v)", model, actual, expected, err)
		}
	}
	var user models.User
	if err := db.First(&user, "user_id = ?", demoUserID).Error; err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(demoPassword)); err != nil {
		t.Fatal("demo password does not match stored hash")
	}
	created, err = seedCustomerDemo(db, now.Add(time.Hour))
	if err != nil || created {
		t.Fatalf("rerun must skip all writes: created=%v err=%v", created, err)
	}
}
