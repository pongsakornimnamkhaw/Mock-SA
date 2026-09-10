package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestSeatsEndpointMaterialisesDefaultGridWhenLayoutMissing(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	body := managementRequest(t, app, "GET", "/api/concerts/CCGRID/zones/A1/seats", nil, fiber.StatusOK)
	rows, ok := body["data"].([]interface{})
	if !ok {
		t.Fatalf("ต้องได้ data เป็น array แต่ได้ %T", body["data"])
	}
	if len(rows) != 40 {
		t.Fatalf("ผังเริ่มต้นต้องมี 40 ที่ (5 แถว x 8) แต่ได้ %d", len(rows))
	}

	var stored int64
	db.Model(&models.Seat{}).Where("concert_id = ? AND zone_id = ?", "CCGRID", "A1").Count(&stored)
	if stored != 40 {
		t.Fatalf("ที่นั่งต้องถูกบันทึกลงฐานข้อมูลจริง แต่มี %d แถว", stored)
	}

	first := rows[0].(map[string]interface{})
	if first["label"] != "A1" || first["status"] != seatStatusAvailable {
		t.Fatalf("ที่นั่งใบแรกผิด: %+v", first)
	}
}

func TestSeatsEndpointReportsTakenSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := db.Create(&models.Zone{ZoneID: "Z1", ZoneType: "นั่ง", Capacity: 2}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatID: "SA1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusAvailable, ConcertID: "CCT", ZoneID: "Z1"},
		{SeatID: "SA2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCT", ZoneID: "Z1"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}

	body := managementRequest(t, app, "GET", "/api/concerts/CCT/zones/Z1/seats", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 2 {
		t.Fatalf("ต้องได้ 2 ใบ แต่ได้ %d", len(rows))
	}
	second := rows[1].(map[string]interface{})
	if second["label"] != "A2" || second["status"] != seatStatusTaken {
		t.Fatalf("ที่นั่งที่ถูกจองต้องรายงานว่าไม่ว่าง: %+v", second)
	}
}

func TestZonesEndpointReturnsPriceAndAvailability(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := db.Create(&models.Zone{ZoneID: "Z9", ZoneType: "นั่ง", Capacity: 2, Color: "#E53935"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.TicketCategory{CategoryID: "TC-Z9", CategoryName: "โซน A", Price: 1800, Quantity: 2, ZoneID: "Z9"}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatID: "SZ1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusAvailable, ConcertID: "CCZ", ZoneID: "Z9"},
		{SeatID: "SZ2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCZ", ZoneID: "Z9"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}

	body := managementRequest(t, app, "GET", "/api/concerts/CCZ/zones", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 1 {
		t.Fatalf("ต้องได้ 1 โซน แต่ได้ %d", len(rows))
	}
	zone := rows[0].(map[string]interface{})
	if zone["zone_id"] != "Z9" || zone["price"].(float64) != 1800 {
		t.Fatalf("ข้อมูลโซนผิด: %+v", zone)
	}
	if zone["available"].(float64) != 1 {
		t.Fatalf("ต้องเหลือที่นั่งว่าง 1 ใบ แต่ได้ %v", zone["available"])
	}
}
