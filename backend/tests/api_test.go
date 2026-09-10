package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"backend/internal/config"
	"backend/internal/eventregistration"
	"backend/internal/models"
	"backend/internal/ticketplanning"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupTestDB initializes DB connection for testing using env or fallback defaults
func setupTestDB(t *testing.T) *gorm.DB {
	config.LoadEnv()

	host := getEnvOrDefault("DB_HOST", "localhost")
	user := getEnvOrDefault("DB_USER", "admin_T01SA")
	password := getEnvOrDefault("DB_PASSWORD", "T01SA")
	dbname := getEnvOrDefault("DB_NAME", "backend_T01")
	port := getEnvOrDefault("DB_PORT", "5432")
	sslmode := getEnvOrDefault("DB_SSLMODE", "disable")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		host, user, password, dbname, port, sslmode)

	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping test: Database connection failed: %v", err)
	}
	schemaName := "ticket_planning_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := admin.Exec(`CREATE SCHEMA "` + schemaName + `"`).Error; err != nil {
		t.Fatalf("Failed to create isolated test schema: %v", err)
	}
	t.Cleanup(func() {
		if !strings.HasPrefix(schemaName, "ticket_planning_test_") || len(schemaName) != 53 {
			t.Errorf("unsafe test schema cleanup target %q", schemaName)
			return
		}
		if err := admin.Exec(`DROP SCHEMA "` + schemaName + `" CASCADE`).Error; err != nil {
			t.Errorf("Failed to clean isolated test schema: %v", err)
		}
	})

	db, err := gorm.Open(postgres.Open(dsn+" search_path="+schemaName), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("Failed to connect to isolated test schema: %v", err)
	}

	if err := models.MigrateAllModels(db); err != nil {
		t.Fatalf("Failed to migrate test models: %v", err)
	}

	config.DB = db
	return db
}

func getEnvOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func setupTestApp(db *gorm.DB) *fiber.App {
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Welcome to Go Backend API",
			"status":  "success",
		})
	})
	ticketplanning.RegisterRoutes(app, db)
	eventregistration.RegisterRoutes(app, db)
	return app
}

// Test 1: ทดสอบยิง GET /
func TestRootEndpoint(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Failed to execute request: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var res map[string]interface{}
	if err := json.Unmarshal(body, &res); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if res["status"] != "success" {
		t.Errorf("Expected status 'success', got '%v'", res["status"])
	}
}

func TestAutoMigrateTwicePreservesPlanningDataAndExcludesLegacyTables(t *testing.T) {
	db := setupTestDB(t)
	concert := models.Concert{
		ConcertID:   "test-migrate-" + strings.ReplaceAll(uuid.NewString(), "-", ""),
		ConcertName: "Migration Safety Test", StartDate: "2026-09-10", EndDate: "2026-09-10",
		StartTime: "18:00:00", EndTime: "20:00:00", Location: "Test Hall", Status: "Draft",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	if err := models.MigrateAllModels(db); err != nil {
		t.Fatalf("second AutoMigrate failed: %v", err)
	}
	var count int64
	if err := db.Model(&models.Concert{}).Where("concert_id = ?", concert.ConcertID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("second AutoMigrate changed existing planning data; concert count = %d", count)
	}
	for _, table := range []string{"venue_seat_plans", "venue_seat_rounds", "venue_seat_zones", "venue_seats", "venue_layout_objects", "venue_seat_publications"} {
		if db.Migrator().HasTable(table) {
			t.Fatalf("legacy table %q was created", table)
		}
	}
}

func TestEventRegistrationDashboardDerivesConcertThroughZone(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	concert := models.Concert{ConcertID: "dashboard-zone-test", ConcertName: "Dashboard Test", StartDate: "2026-09-10", EndDate: "2026-09-10", StartTime: "18:00:00", EndTime: "20:00:00", Location: "Hall", Status: "Draft"}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	zone := models.Zone{ZoneID: "dashboard-zone", ConcertID: concert.ConcertID, ZoneType: "A", Capacity: 2, ZonePrice: 1000}
	if err := db.Create(&zone).Error; err != nil {
		t.Fatal(err)
	}
	seat := models.Seat{ZoneID: zone.ZoneID, SeatLabel: "A1", SeatRow: 1, SeatColumn: 1, StatusSeat: "AVAILABLE"}
	if err := db.Create(&seat).Error; err != nil {
		t.Fatal(err)
	}
	booking := models.Booking{BookingID: "dashboard-booking", BookingDate: time.Now(), Status: "สำเร็จ", ConcertID: concert.ConcertID}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	ticket := models.Ticket{NameConcert: concert.ConcertName, TicketDateTime: time.Now(), PriceTicket: zone.ZonePrice, StatusTicket: "พร้อมใช้งาน", SeatID: seat.SeatID, BookingID: booking.BookingID}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/event-registration/concerts/"+concert.ConcertID+"/dashboard", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("dashboard got %d: %s", resp.StatusCode, body)
	}
	var dashboard struct {
		TotalTickets int64 `json:"totalTickets"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dashboard); err != nil {
		t.Fatal(err)
	}
	if dashboard.TotalTickets != 1 {
		t.Fatalf("totalTickets = %d, want 1", dashboard.TotalTickets)
	}

	checkInBody, _ := json.Marshal(map[string]interface{}{"ticketId": ticket.TicketID, "gateId": 1, "concertId": concert.ConcertID})
	checkIn := func() int {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/event-registration/check-ins", bytes.NewReader(checkInBody))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		return resp.StatusCode
	}
	if got := checkIn(); got != http.StatusCreated {
		t.Fatalf("first numeric-ID check-in got %d, want 201", got)
	}
	if got := checkIn(); got != http.StatusConflict {
		t.Fatalf("repeated check-in got %d, want 409", got)
	}

	missingReq := httptest.NewRequest(http.MethodGet, "/api/event-registration/tickets/999999999?concertId="+concert.ConcertID, nil)
	missingResp, err := app.Test(missingReq, -1)
	if err != nil || missingResp.StatusCode != http.StatusNotFound {
		t.Fatalf("missing ticket lookup got status=%d err=%v, want 404", missingResp.StatusCode, err)
	}

	secondSeat := models.Seat{ZoneID: zone.ZoneID, SeatLabel: "A2", SeatRow: 1, SeatColumn: 2, StatusSeat: "AVAILABLE"}
	if err := db.Create(&secondSeat).Error; err != nil {
		t.Fatal(err)
	}
	secondTicket := models.Ticket{NameConcert: concert.ConcertName, TicketDateTime: time.Now(), PriceTicket: zone.ZonePrice, StatusTicket: "พร้อมใช้งาน", SeatID: secondSeat.SeatID, BookingID: booking.BookingID}
	if err := db.Create(&secondTicket).Error; err != nil {
		t.Fatal(err)
	}
	wrongBody, _ := json.Marshal(map[string]interface{}{"ticketId": secondTicket.TicketID, "gateId": 1, "concertId": "another-concert"})
	wrongReq := httptest.NewRequest(http.MethodPost, "/api/event-registration/check-ins", bytes.NewReader(wrongBody))
	wrongReq.Header.Set("Content-Type", "application/json")
	wrongResp, err := app.Test(wrongReq, -1)
	if err != nil || wrongResp.StatusCode != http.StatusConflict {
		t.Fatalf("wrong-concert check-in got status=%d err=%v, want 409", wrongResp.StatusCode, err)
	}
}

// Test 2: ทดสอบยิง POST /api/ticket-planning/concerts เพื่อสร้าง Concert เข้า DB จริง
func TestCreateAndGetConcertAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)

	testConcertID := fmt.Sprintf("test-cc-%d", time.Now().UnixNano())
	payload := map[string]interface{}{
		"id":          testConcertID,
		"name":        "Integration Test Live Concert",
		"artist":      "Test Artist",
		"date":        "2026-10-15",
		"endDate":     "2026-10-16",
		"location":    "Impact Arena",
		"category":    "Music Festival",
		"status":      "Upcoming",
		"description": "Integration test description",
		"cover":       "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		"rounds": []map[string]interface{}{
			{
				"name":     "Round 1",
				"date":     "2026-10-15",
				"doorTime": "18:00",
				"status":   "Available",
			},
		},
		"publishing": map[string]interface{}{
			"scheduleFile":  "schedule.pdf",
			"scheduleImage": "",
			"saleStart":     "2026-09-01T10:00",
			"saleEnd":       "2026-10-15T18:00",
			"publishAt":     "2026-08-01T09:00",
			"unpublishAt":   "2026-10-17T00:00",
		},
	}

	jsonBytes, _ := json.Marshal(payload)

	// POST /api/ticket-planning/concerts
	req := httptest.NewRequest(http.MethodPost, "/api/ticket-planning/concerts", bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("POST concerts request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200 on POST, got %d, body: %s", resp.StatusCode, string(body))
	}

	// GET /api/ticket-planning/concerts/:id
	getReq := httptest.NewRequest(http.MethodGet, "/api/ticket-planning/concerts/"+testConcertID, nil)
	getResp, err := app.Test(getReq, -1)
	if err != nil {
		t.Fatalf("GET concert request failed: %v", err)
	}

	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("Expected status 200 on GET, got %d", getResp.StatusCode)
	}

	getBody, _ := io.ReadAll(getResp.Body)
	var concertRes map[string]interface{}
	if err := json.Unmarshal(getBody, &concertRes); err != nil {
		t.Fatalf("Failed to parse GET response JSON: %v", err)
	}

	if concertRes["name"] != "Integration Test Live Concert" {
		t.Errorf("Expected concert name 'Integration Test Live Concert', got '%v'", concertRes["name"])
	}

	// Clean up test data
	t.Cleanup(func() {
		db.Where("concert_id = ?", testConcertID).Delete(&models.PerformanceSchedule{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Publication{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})
}

// Test 3: ทดสอบยิง PUT /api/ticket-planning/concerts/:id/layout บันทึก Layout
func TestSaveLayoutAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)

	testConcertID := fmt.Sprintf("test-layout-%d", time.Now().UnixNano())
	// สร้าง concert ก่อน
	concert := models.Concert{
		ConcertID:     testConcertID,
		ConcertName:   "Layout Test Concert",
		StartDate:     "2026-04-12",
		EndDate:       "2026-04-16",
		StartTime:     "17:00:00",
		EndTime:       "00:00:00",
		Location:      "Hall 1",
		Status:        "Draft",
		ConcertPoster: []byte(""),
		Poster:        []byte(""),
		MoreInfo:      "Layout info",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("Failed to insert initial concert for layout test: %v", err)
	}

	layoutPayload := map[string]interface{}{
		"zones": []map[string]interface{}{
			{
				"id":        "zone-vip-1",
				"kind":      "zone",
				"name":      "VIP A",
				"color":     "#FF0000",
				"seats":     2,
				"zonePrice": 3500.0,
				"type":      "seated",
				"shape":     "rect",
				"x":         100.0,
				"y":         200.0,
				"width":     150.0,
				"height":    80.0,
				"z":         1,
				"seatItems": []map[string]interface{}{
					{"clientKey": "seat-a1", "name": "A1", "x": 105.0, "y": 210.0, "disabled": false},
					{"clientKey": "seat-a2", "name": "A2", "x": 135.0, "y": 210.0, "disabled": false},
				},
			},
		},
		"layoutObjects": []map[string]interface{}{
			{
				"id":        "obj-stage-1",
				"kind":      "stage",
				"shape":     "rect",
				"name":      "Main Stage",
				"color":     "#333333",
				"textColor": "#FFFFFF",
				"x":         200.0,
				"y":         50.0,
				"width":     300.0,
				"height":    100.0,
				"z":         0,
			},
		},
	}

	jsonBytes, _ := json.Marshal(layoutPayload)
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/ticket-planning/concerts/%s/layout", testConcertID), bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("PUT layout request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200 on PUT layout, got %d, body: %s", resp.StatusCode, string(body))
	}
	var savedLayout struct {
		Zones []struct {
			ZonePrice float64 `json:"zonePrice"`
			SeatItems []struct {
				ID uint `json:"id"`
			} `json:"seatItems"`
		} `json:"zones"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&savedLayout); err != nil {
		t.Fatalf("decode saved layout: %v", err)
	}
	if len(savedLayout.Zones) != 1 || savedLayout.Zones[0].ZonePrice != 3500 || len(savedLayout.Zones[0].SeatItems) != 2 || savedLayout.Zones[0].SeatItems[0].ID == 0 {
		t.Fatalf("saved layout did not return zone price and database seat IDs: %+v", savedLayout)
	}

	booking := models.Booking{BookingID: "booking-" + strings.ReplaceAll(uuid.NewString(), "-", ""), BookingDate: time.Now(), Status: "สำเร็จ", ConcertID: testConcertID}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	ticket := models.Ticket{NameConcert: concert.ConcertName, TicketDateTime: time.Now(), PriceTicket: savedLayout.Zones[0].ZonePrice, StatusTicket: "พร้อมใช้งาน", SeatID: savedLayout.Zones[0].SeatItems[0].ID, BookingID: booking.BookingID}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatal(err)
	}

	seatItems := layoutPayload["zones"].([]map[string]interface{})[0]["seatItems"].([]map[string]interface{})
	seatItems[0] = map[string]interface{}{"id": savedLayout.Zones[0].SeatItems[0].ID, "name": "A1", "x": 105.0, "y": 210.0, "disabled": false}
	seatItems[1] = map[string]interface{}{"id": savedLayout.Zones[0].SeatItems[1].ID, "name": "A2", "x": 135.0, "y": 210.0, "disabled": false}
	layoutPayload["zones"].([]map[string]interface{})[0]["zonePrice"] = 4200.0
	updatedJSON, _ := json.Marshal(layoutPayload)
	updatedReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/ticket-planning/concerts/%s/layout", testConcertID), bytes.NewReader(updatedJSON))
	updatedReq.Header.Set("Content-Type", "application/json")
	updatedResp, err := app.Test(updatedReq, -1)
	if err != nil || updatedResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(updatedResp.Body)
		t.Fatalf("updating ZonePrice failed: status=%d err=%v body=%s", updatedResp.StatusCode, err, body)
	}
	var unchanged models.Ticket
	if err := db.First(&unchanged, ticket.TicketID).Error; err != nil {
		t.Fatal(err)
	}
	if unchanged.PriceTicket != 3500 {
		t.Fatalf("existing ticket price changed with ZonePrice: got %.2f", unchanged.PriceTicket)
	}

	seatItems[0]["name"] = "RENAMED"
	conflictJSON, _ := json.Marshal(layoutPayload)
	conflictReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/ticket-planning/concerts/%s/layout", testConcertID), bytes.NewReader(conflictJSON))
	conflictReq.Header.Set("Content-Type", "application/json")
	conflictResp, err := app.Test(conflictReq, -1)
	if err != nil || conflictResp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(conflictResp.Body)
		t.Fatalf("renaming issued seat got status=%d err=%v body=%s, want 409", conflictResp.StatusCode, err, body)
	}

	seatItems[0]["name"] = "A1"
	layoutPayload["zones"].([]map[string]interface{})[0]["seats"] = 0
	capacityJSON, _ := json.Marshal(layoutPayload)
	capacityReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/ticket-planning/concerts/%s/layout", testConcertID), bytes.NewReader(capacityJSON))
	capacityReq.Header.Set("Content-Type", "application/json")
	capacityResp, err := app.Test(capacityReq, -1)
	if err != nil || capacityResp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(capacityResp.Body)
		t.Fatalf("capacity below issued ticket count got status=%d err=%v body=%s, want 409", capacityResp.StatusCode, err, body)
	}

	// Clean up
	t.Cleanup(func() {
		db.Where("ticket_id = ?", ticket.TicketID).Delete(&models.Ticket{})
		db.Where("booking_id = ?", booking.BookingID).Delete(&models.Booking{})
		db.Where("zone_id = ?", "zone-vip-1").Delete(&models.Seat{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Zone{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.LayoutObject{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})
}

// Test 4: ทดสอบ Insert ข้อมูล User เข้าฐานข้อมูลจริง ตรวจสอบเงื่อนไข Not Null
func TestUserDatabaseModel(t *testing.T) {
	db := setupTestDB(t)

	testUser := models.User{
		UserID:      fmt.Sprintf("US%06d", time.Now().Unix()%900000+100000),
		FirstName:   "Sompong",
		LastName:    "Jaidee",
		DateOfBirth: time.Date(1995, 5, 20, 0, 0, 0, 0, time.UTC),
		Gender:      "Male",
		PhoneNumber: "0812345678",
		Address:     "123 Bangkok Road",
		Email:       fmt.Sprintf("sompong_%d@example.com", time.Now().UnixNano()),
		UserType:    "Customer",
		Role:        "User",
		CompanyName: "None",
	}

	if err := db.Create(&testUser).Error; err != nil {
		t.Fatalf("Failed to insert User into database: %v", err)
	}

	var fetched models.User
	if err := db.First(&fetched, "user_id = ?", testUser.UserID).Error; err != nil {
		t.Fatalf("Failed to query User: %v", err)
	}

	if fetched.FirstName != testUser.FirstName || fetched.Email != testUser.Email {
		t.Errorf("Fetched user does not match created user: got %+v, expected %+v", fetched, testUser)
	}

	// Clean up
	t.Cleanup(func() {
		db.Where("user_id = ?", testUser.UserID).Delete(&models.User{})
	})
}
