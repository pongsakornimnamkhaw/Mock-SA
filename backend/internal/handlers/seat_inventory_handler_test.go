package handlers

import (
	"fmt"
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// ensureZoneSeats เป็น test fixture เท่านั้น Production GET/Booking ห้ามสร้างผังจำลอง
func ensureZoneSeats(db *gorm.DB, concertID, zoneID string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := ensureTestConcert(tx, concertID); err != nil {
			return err
		}
		zone := models.Zone{ZoneID: zoneID, ConcertID: concertID, ZoneType: "ที่นั่ง", Capacity: 40, ZonePrice: 2000}
		if err := tx.Where("zone_id = ?", zoneID).FirstOrCreate(&zone).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.Seat{}).Where("zone_id = ?", zoneID).Count(&count).Error; err != nil || count > 0 {
			return err
		}
		seats := make([]models.Seat, 0, 40)
		for row := 1; row <= 5; row++ {
			for column := 1; column <= 8; column++ {
				seats = append(seats, models.Seat{SeatLabel: fmt.Sprintf("%c%d", 'A'+rune(row-1), column), SeatRow: row, SeatColumn: column, StatusSeat: seatStatusAvailable, ZoneID: zoneID})
			}
		}
		return tx.Create(&seats).Error
	})
}

func ensureTestConcert(db *gorm.DB, concertID string) error {
	concert := models.Concert{ConcertID: concertID, ConcertName: "งานทดสอบ", StartDate: "2026-09-11", EndDate: "2026-09-11", StartTime: "18:00", EndTime: "20:00", Location: "Test Hall", Status: "เปิดขาย", MoreInfo: "test"}
	return db.Where("concert_id = ?", concertID).FirstOrCreate(&concert).Error
}

func TestSeatsEndpointDoesNotMaterialiseDefaultGridWhenLayoutMissing(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	body := managementRequest(t, app, "GET", "/api/concerts/CCGRID/zones/A1/seats", nil, fiber.StatusNotFound)
	if body["error"] == "" {
		t.Fatal("ต้องแจ้งว่าไม่พบโซน")
	}

	var storedZones int64
	db.Model(&models.Zone{}).Where("zone_id = ?", "A1").Count(&storedZones)
	if storedZones != 0 {
		t.Fatalf("GET ต้องไม่สร้างโซน แต่พบ %d แถว", storedZones)
	}

	var storedSeats int64
	db.Model(&models.Seat{}).Where("zone_id = ?", "A1").Count(&storedSeats)
	if storedSeats != 0 {
		t.Fatalf("GET ต้องไม่สร้างที่นั่ง แต่พบ %d แถว", storedSeats)
	}
}

func TestSeatsEndpointReturnsEmptyArrayForExistingZoneWithoutSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureTestConcert(db, "CCGRID"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "EMPTY", ConcertID: "CCGRID", ZoneType: "นั่ง", Capacity: 0}).Error; err != nil {
		t.Fatal(err)
	}
	body := managementRequest(t, app, "GET", "/api/concerts/CCGRID/zones/EMPTY/seats", nil, fiber.StatusOK)
	rows, ok := body["data"].([]interface{})
	if !ok {
		t.Fatalf("ต้องได้ data เป็น array แต่ได้ %T", body["data"])
	}
	if len(rows) != 0 {
		t.Fatalf("โซนว่างต้องได้ 0 ที่นั่ง แต่ได้ %d", len(rows))
	}
}

func TestSeatsEndpointReportsTakenSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureTestConcert(db, "CCT"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "Z1", ConcertID: "CCT", ZoneType: "นั่ง", Capacity: 2}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatLabel: "A1", SeatRow: 1, SeatColumn: 1, StatusSeat: seatStatusAvailable, ZoneID: "Z1"},
		{SeatLabel: "A2", SeatRow: 1, SeatColumn: 2, StatusSeat: seatStatusTaken, ZoneID: "Z1"},
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

	if err := ensureTestConcert(db, "CCZ"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "Z9", ConcertID: "CCZ", ZoneType: "นั่ง", Capacity: 2, Color: "#E53935", ZonePrice: 1800}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatLabel: "A1", SeatRow: 1, SeatColumn: 1, StatusSeat: seatStatusAvailable, ZoneID: "Z9"},
		{SeatLabel: "A2", SeatRow: 1, SeatColumn: 2, StatusSeat: seatStatusTaken, ZoneID: "Z9"},
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

func TestInventoryTreatsTicketPlanningAvailableSeatAsAvailable(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureTestConcert(db, "CCPLAN"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "ZPLAN", ConcertID: "CCPLAN", ZoneType: "VIP", Capacity: 1, ZonePrice: 2200}).Error; err != nil {
		t.Fatal(err)
	}
	seat := models.Seat{SeatLabel: "A1", SeatRow: 1, SeatColumn: 1, StatusSeat: "AVAILABLE", ZoneID: "ZPLAN"}
	if err := db.Create(&seat).Error; err != nil {
		t.Fatal(err)
	}

	zones := managementRequest(t, app, "GET", "/api/concerts/CCPLAN/zones", nil, fiber.StatusOK)
	zone := zones["data"].([]interface{})[0].(map[string]interface{})
	if zone["available"].(float64) != 1 {
		t.Fatalf("ที่นั่ง AVAILABLE จากหน้าออกแบบต้องถูกนับว่าว่าง แต่ได้ %+v", zone)
	}

	seats := managementRequest(t, app, "GET", "/api/concerts/CCPLAN/zones/ZPLAN/seats", nil, fiber.StatusOK)
	row := seats["data"].([]interface{})[0].(map[string]interface{})
	if row["status"] != seatStatusAvailable {
		t.Fatalf("API ลูกค้าต้องคืนสถานะว่างแบบเดียวกัน แต่ได้ %+v", row)
	}

	hold := managementRequest(t, app, "POST", "/api/seat-holds", map[string]interface{}{
		"concert_id": "CCPLAN",
		"zone_id":    "ZPLAN",
		"seat_ids":   []uint{seat.SeatID},
	}, fiber.StatusCreated)
	if hold["hold_token"] == "" {
		t.Fatalf("ที่นั่ง AVAILABLE ต้องสามารถ hold ได้ แต่ได้ %+v", hold)
	}
}

func TestSeatHoldIsVisibleToOwnerAndOtherCustomers(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureTestConcert(db, "CCHOLD"); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "ZHOLD", ConcertID: "CCHOLD", ZoneType: "VIP", Capacity: 1, ZonePrice: 2500}).Error; err != nil {
		t.Fatal(err)
	}
	seat := models.Seat{SeatLabel: "A1", SeatRow: 1, SeatColumn: 1, StatusSeat: seatStatusAvailable, ZoneID: "ZHOLD"}
	if err := db.Create(&seat).Error; err != nil {
		t.Fatal(err)
	}

	hold := managementRequest(t, app, "POST", "/api/seat-holds", map[string]interface{}{
		"concert_id": "CCHOLD",
		"zone_id":    "ZHOLD",
		"seat_ids":   []uint{seat.SeatID},
	}, fiber.StatusCreated)
	token, _ := hold["hold_token"].(string)
	if token == "" {
		t.Fatalf("ต้องคืน hold_token แต่ได้ %+v", hold)
	}

	otherView := managementRequest(t, app, "GET", "/api/concerts/CCHOLD/zones/ZHOLD/seats", nil, fiber.StatusOK)
	otherSeat := otherView["data"].([]interface{})[0].(map[string]interface{})
	if otherSeat["status"] != seatInventoryStatusHeld {
		t.Fatalf("ผู้ใช้อื่นต้องเห็น HELD แต่ได้ %+v", otherSeat)
	}

	ownerView := managementRequest(t, app, "GET", "/api/concerts/CCHOLD/zones/ZHOLD/seats?hold_token="+token, nil, fiber.StatusOK)
	ownerSeat := ownerView["data"].([]interface{})[0].(map[string]interface{})
	if ownerSeat["status"] != seatInventoryStatusLocked {
		t.Fatalf("เจ้าของ hold ต้องเห็น LOCKED แต่ได้ %+v", ownerSeat)
	}

	zones := managementRequest(t, app, "GET", "/api/concerts/CCHOLD/zones", nil, fiber.StatusOK)
	zone := zones["data"].([]interface{})[0].(map[string]interface{})
	if zone["available"].(float64) != 0 {
		t.Fatalf("โซนต้องเต็มระหว่าง hold แต่ได้ %+v", zone)
	}

	conflict := managementRequest(t, app, "POST", "/api/seat-holds", map[string]interface{}{
		"concert_id": "CCHOLD",
		"zone_id":    "ZHOLD",
		"seat_ids":   []uint{seat.SeatID},
	}, fiber.StatusConflict)
	if conflict["error"] == "" {
		t.Fatal("ต้องแจ้ง seat conflict")
	}

	managementRequest(t, app, "DELETE", "/api/seat-holds/"+token, nil, fiber.StatusOK)
	released := managementRequest(t, app, "GET", "/api/concerts/CCHOLD/zones/ZHOLD/seats", nil, fiber.StatusOK)
	releasedSeat := released["data"].([]interface{})[0].(map[string]interface{})
	if releasedSeat["status"] != seatStatusAvailable {
		t.Fatalf("ยกเลิก hold แล้วต้องกลับมาว่าง แต่ได้ %+v", releasedSeat)
	}
}
