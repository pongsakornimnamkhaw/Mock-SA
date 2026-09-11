package main

import (
	"fmt"
	"log"
	"os"

	"backend/internal/config"
	"backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	if _, err := os.Stat(".env"); err != nil {
		fmt.Fprintln(os.Stderr, "Run from backend/ directory")
		os.Exit(1)
	}
	config.LoadEnv()
	config.ConnectDB()
	db := config.DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)})

	fmt.Println("=== ข้อมูล DEMO_CUSTOMER_V1_ ในฐานข้อมูล ===")
	rows := []struct {
		name  string
		table string
		pk    string
	}{
		{"users", "users", "user_id"},
		{"bookings", "bookings", "booking_id"},
		{"payments", "payments", "payment_id"},
		{"tickets", "tickets", "ticket_id"},
		{"seats", "seats", "seat_id"},
		{"zones", "zones", "zone_id"},
		{"promotions", "promotions", "promotion_id"},
	}
	allOk := true
	for _, r := range rows {
		var n int64
		db.Table(r.table).Where(r.pk+" LIKE ?", "DEMO_CUSTOMER%").Count(&n)
		icon := "✅"
		if n == 0 { icon = "❌"; allOk = false }
		fmt.Printf("  %s %-12s : %d\n", icon, r.name, n)
	}

	var total int64
	db.Model(&models.Concert{}).Count(&total)
	fmt.Printf("\nConcerts ทั้งหมดใน DB: %d\n", total)

	if !allOk {
		fmt.Println("\n❌ ข้อมูลบางส่วนหายไป — รัน: go run ./cmd/seed-customer-demo --apply")
		os.Exit(1)
	}

	var user models.User
	if err := db.Where("user_id = ?", "DEMO_CUSTOMER_V1_USER").First(&user).Error; err != nil {
		log.Fatal(err)
	}
	fmt.Printf("\n✅ email: %s\n", user.Email)
	fmt.Printf("   user_type: %s\n", user.UserType)
	fmt.Printf("   password_hash set: %v\n", len(user.PasswordHash) > 0)
}
