package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestSaveLayoutWritesTicketingTables(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterVenueSeatRoutes(app, db)

	if err := db.Create(&models.Concert{
		ConcertID: "CCPROJ", ConcertName: "งานทดสอบผัง", StartDate: "2026-11-01", EndDate: "2026-11-01",
		StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "-",
	}).Error; err != nil {
		t.Fatal(err)
	}

	payload := map[string]any{
		"zones": []map[string]any{{
			"id": "ZPROJ1", "name": "โซน A", "type": "นั่ง", "color": "#E53935", "price": 2500,
			"shape": "rectangle", "x": 5, "y": 6, "width": 80, "height": 40, "rotation": 0, "z": 1,
			"seatItems": []map[string]any{
				{"id": "SPROJ1", "name": "A1", "x": 1, "y": 1},
				{"id": "SPROJ2", "name": "A2", "x": 2, "y": 1},
			},
		}},
		"layoutObjects": []map[string]any{},
	}
	managementRequest(t, app, "PUT", "/api/venue-seat/concerts/CCPROJ/layout", payload, fiber.StatusOK)

	var zone models.Zone
	if err := db.First(&zone, "zone_id = ?", "ZPROJ1").Error; err != nil {
		t.Fatal("ต้องมีแถวใน zones:", err)
	}
	if zone.Capacity != 2 || zone.Color != "#E53935" {
		t.Fatalf("ข้อมูลโซนไม่ถูกคัดลอกมา: %+v", zone)
	}

	var seats []models.Seat
	if err := db.Where("concert_id = ?", "CCPROJ").Order("seat_column").Find(&seats).Error; err != nil {
		t.Fatal(err)
	}
	if len(seats) != 2 {
		t.Fatalf("ต้องมีที่นั่ง 2 ใบ แต่ได้ %d", len(seats))
	}
	if seats[0].Label() != "A1" || seats[0].StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งใบแรกผิด: %+v", seats[0])
	}

	var category models.TicketCategory
	if err := db.First(&category, "zone_id = ?", "ZPROJ1").Error; err != nil {
		t.Fatal("ต้องมีแถวใน ticket_categories:", err)
	}
	if category.Price != 2500 || category.Quantity != 2 {
		t.Fatalf("หมวดหมู่ราคาผิด: %+v", category)
	}
}

func TestSaveLayoutKeepsSeatsThatAreAlreadySold(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterVenueSeatRoutes(app, db)

	if err := db.Create(&models.Concert{
		ConcertID: "CCKEEP", ConcertName: "งานทดสอบขายแล้ว", StartDate: "2026-11-01", EndDate: "2026-11-01",
		StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "-",
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "ZKEEP1", ZoneType: "นั่ง", Capacity: 1}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Seat{
		SeatID: "SKEEP1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusTaken,
		ConcertID: "CCKEEP", ZoneID: "ZKEEP1",
	}).Error; err != nil {
		t.Fatal(err)
	}

	payload := map[string]any{
		"zones": []map[string]any{{
			"id": "ZKEEP1", "name": "โซน A", "type": "นั่ง", "price": 1000,
			"seatItems": []map[string]any{{"id": "SKEEP2", "name": "A2", "x": 2, "y": 1}},
		}},
		"layoutObjects": []map[string]any{},
	}
	managementRequest(t, app, "PUT", "/api/venue-seat/concerts/CCKEEP/layout", payload, fiber.StatusOK)

	var sold models.Seat
	if err := db.First(&sold, "seat_id = ?", "SKEEP1").Error; err != nil {
		t.Fatal("ที่นั่งที่ขายไปแล้วต้องไม่ถูกลบทิ้งตอนบันทึกผังใหม่:", err)
	}
	if sold.StatusSeat != seatStatusTaken {
		t.Fatalf("สถานะที่นั่งที่ขายแล้วต้องคงเดิม แต่ได้ %q", sold.StatusSeat)
	}
}
