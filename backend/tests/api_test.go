package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"backend/internal/config"
	"backend/internal/handlers"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
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

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("Skipping test: Database connection failed: %v", err)
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
	handlers.RegisterVenueSeatRoutes(app, db)
	handlers.RegisterRegistrationRoutes(app, db)
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

// Test 2: ข้อมูลทั่วไปและรอบการแสดงอ่านจาก Concert/PerformanceSchedule เท่านั้น
func TestGetConcertAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)

	testConcertID := fmt.Sprintf("test-cc-%d", time.Now().UnixNano())
	concert := models.Concert{
		ConcertID: testConcertID, ConcertName: "Integration Test Live Concert",
		StartDate: "2026-10-15", EndDate: "2026-10-16", StartTime: "19:00:00",
		EndTime: "22:00:00", TimeOpenGate: "18:00:00", Location: "Impact Arena",
		Status: "Upcoming", MoreInfo: "Integration test description",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("create concert: %v", err)
	}
	t.Cleanup(func() {
		db.Where("concert_id = ?", testConcertID).Delete(&models.PerformanceSchedule{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Publication{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})
	schedule := models.PerformanceSchedule{
		ConcertID: testConcertID, PerformanceOrder: 1, Details: "show",
		StartShow: "19:00:00", EndShow: "21:30:00", ShowDate: "2026-10-15",
	}
	if err := db.Create(&schedule).Error; err != nil {
		t.Fatalf("create schedule: %v", err)
	}

	// GET /api/venue-seat/concerts/:id
	getReq := httptest.NewRequest(http.MethodGet, "/api/venue-seat/concerts/"+testConcertID, nil)
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
	rounds, ok := concertRes["rounds"].([]interface{})
	if !ok || len(rounds) != 1 {
		t.Fatalf("expected one performance round, got %#v", concertRes["rounds"])
	}
	round := rounds[0].(map[string]interface{})
	if round["date"] != "2026-10-15" || round["doorTime"] != "18:00:00" || round["startShow"] != "19:00:00" || round["endShow"] != "21:30:00" {
		t.Fatalf("unexpected round mapping: %#v", round)
	}

	publicationPayload := map[string]interface{}{
		"description": "เปิดขายรอบแรก",
		"posterImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		"saleStart":   "2026-09-01T10:00",
		"saleEnd":     "2026-10-15T18:00",
		"publishAt":   "2026-08-01T09:00",
		"unpublishAt": "2026-10-17T00:00",
	}
	publicationJSON, _ := json.Marshal(publicationPayload)
	publicationReq := httptest.NewRequest(http.MethodPut, "/api/venue-seat/concerts/"+testConcertID+"/publication", bytes.NewReader(publicationJSON))
	publicationReq.Header.Set("Content-Type", "application/json")
	publicationResp, err := app.Test(publicationReq, -1)
	if err != nil || publicationResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(publicationResp.Body)
		t.Fatalf("save publication failed: status=%d error=%v body=%s", publicationResp.StatusCode, err, body)
	}
	var publication models.Publication
	if err := db.First(&publication, "concert_id = ?", testConcertID).Error; err != nil {
		t.Fatalf("publication not persisted: %v", err)
	}
	if publication.Describtion != "เปิดขายรอบแรก" || len(publication.PosterWeb) == 0 {
		t.Fatalf("unexpected publication: %#v", publication)
	}

	publicationPayload["description"] = "ปรับข้อมูลการเผยแพร่"
	publicationPayload["saleStart"] = ""
	publicationPayload["saleEnd"] = ""
	publicationPayload["publishAt"] = ""
	publicationPayload["unpublishAt"] = ""
	publicationJSON, _ = json.Marshal(publicationPayload)
	publicationReq = httptest.NewRequest(http.MethodPut, "/api/venue-seat/concerts/"+testConcertID+"/publication", bytes.NewReader(publicationJSON))
	publicationReq.Header.Set("Content-Type", "application/json")
	publicationResp, err = app.Test(publicationReq, -1)
	if err != nil || publicationResp.StatusCode != http.StatusOK {
		t.Fatalf("update nullable publication dates failed: status=%d error=%v", publicationResp.StatusCode, err)
	}
	publication = models.Publication{}
	if err := db.First(&publication, "concert_id = ?", testConcertID).Error; err != nil {
		t.Fatalf("reload updated publication: %v", err)
	}
	if publication.Describtion != "ปรับข้อมูลการเผยแพร่" || publication.SaleOpenDate != nil || publication.BookingCloseDatetime != nil || publication.OpenInWeb != nil || publication.OutWeb != nil {
		t.Fatalf("nullable publication dates were not cleared: %#v", publication)
	}

	readOnlyReq := httptest.NewRequest(http.MethodPut, "/api/venue-seat/concerts/"+testConcertID, bytes.NewReader([]byte(`{"name":"must not change"}`)))
	readOnlyReq.Header.Set("Content-Type", "application/json")
	readOnlyResp, err := app.Test(readOnlyReq, -1)
	if err != nil || readOnlyResp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("general/round data must be read-only, status=%d error=%v", readOnlyResp.StatusCode, err)
	}

}

// Test 3: ทดสอบยิง PUT /api/venue-seat/concerts/:id/layout บันทึก Layout
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
		TimeOpenGate:  "16:00:00",
		Location:      "Hall 1",
		Status:        "Draft",
		ConcertPoster: []byte(""),
		Poster:        []byte(""),
		MoreInfo:      "Layout info",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("Failed to insert initial concert for layout test: %v", err)
	}
	var booking models.Booking
	t.Cleanup(func() {
		var seatIDs []int
		db.Model(&models.Seat{}).Where("concert_id = ?", testConcertID).Pluck("seat_id", &seatIDs)
		if len(seatIDs) > 0 {
			db.Where("seat_id IN ?", seatIDs).Delete(&models.Ticket{})
		}
		if booking.BookingID != "" {
			db.Where("booking_id = ?", booking.BookingID).Delete(&models.Booking{})
		}
		db.Where("concert_id = ?", testConcertID).Delete(&models.Seat{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Zone{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})

	layoutPayload := map[string]interface{}{
		"flowchart": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
		"zones": []map[string]interface{}{
			{
				"id":     "zone-vip-1",
				"kind":   "zone",
				"name":   "VIP A",
				"color":  "#FF0000",
				"seats":  2,
				"price":  3500.0,
				"type":   "seated",
				"shape":  "rect",
				"x":      100.0,
				"y":      200.0,
				"width":  150.0,
				"height": 80.0,
				"z":      1,
				"seatItems": []map[string]interface{}{
					{"id": "seat-a1", "name": "A1", "x": 105.0, "y": 210.0, "disabled": false},
					{"id": "seat-a2", "name": "A2", "x": 135.0, "y": 210.0, "disabled": false},
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
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/venue-seat/concerts/%s/layout", testConcertID), bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("PUT layout request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200 on PUT layout, got %d, body: %s", resp.StatusCode, string(body))
	}
	var seats []models.Seat
	if err := db.Where("concert_id = ?", testConcertID).Order("seat_id").Find(&seats).Error; err != nil {
		t.Fatalf("load seats: %v", err)
	}
	if len(seats) != 2 || seats[0].SeatID == 0 || seats[0].SeatRow != "A" || seats[0].SeatColumn != "1" {
		t.Fatalf("unexpected persisted seats: %#v", seats)
	}
	if len(seats[0].Flowchart) == 0 || !bytes.Equal(seats[0].Flowchart, seats[1].Flowchart) {
		t.Fatal("flowchart was not duplicated to every seat")
	}
	var tickets []models.Ticket
	if err := db.Where("seat_id IN ?", []int{seats[0].SeatID, seats[1].SeatID}).Order("ticket_id").Find(&tickets).Error; err != nil {
		t.Fatalf("load tickets: %v", err)
	}
	if len(tickets) != 2 || tickets[0].PriceTicket != 3500 {
		t.Fatalf("unexpected ticket inventory: %#v", tickets)
	}
	for _, legacyTable := range []string{"venue_layout_objects", "venue_seat_plans", "venue_seat_publications", "venue_seat_rounds", "venue_seat_zones", "venue_seats"} {
		if db.Migrator().HasTable(legacyTable) {
			t.Fatalf("legacy table %s still exists", legacyTable)
		}
	}
	if !db.Migrator().HasIndex(&models.Ticket{}, "idx_tickets_seat_id") {
		t.Fatal("tickets.seat_id unique index is missing")
	}
	firstTicketID := tickets[0].TicketID
	if err := models.MigrateAllModels(db); err != nil {
		t.Fatalf("repeat migration failed: %v", err)
	}
	if err := db.First(&models.Ticket{}, "ticket_id = ?", firstTicketID).Error; err != nil {
		t.Fatalf("repeat migration removed ticket data: %v", err)
	}

	getLayout := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/venue-seat/concerts/%s/layout", testConcertID), nil)
	getLayoutResp, err := app.Test(getLayout, -1)
	if err != nil || getLayoutResp.StatusCode != http.StatusOK {
		t.Fatalf("GET layout failed: status=%d error=%v", getLayoutResp.StatusCode, err)
	}
	var savedLayout map[string]interface{}
	if err := json.NewDecoder(getLayoutResp.Body).Decode(&savedLayout); err != nil {
		t.Fatalf("decode saved layout: %v", err)
	}
	if savedLayout["flowchart"] == "" || len(savedLayout["layoutObjects"].([]interface{})) != 1 {
		t.Fatalf("layout did not round-trip: %#v", savedLayout)
	}
	savedZones := savedLayout["zones"].([]interface{})
	savedZone := savedZones[0].(map[string]interface{})
	if savedZone["name"] != "VIP A" || savedZone["price"] != 3500.0 || len(savedZone["seatItems"].([]interface{})) != 2 {
		t.Fatalf("zone/seat/price did not round-trip: %#v", savedZone)
	}

	booking = models.Booking{BookingID: fmt.Sprintf("test-booking-%d", time.Now().UnixNano()), BookingDate: time.Now(), Status: "confirmed"}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatalf("create booking: %v", err)
	}
	if err := db.Model(&models.Ticket{}).Where("ticket_id = ?", tickets[0].TicketID).Update("booking_id", booking.BookingID).Error; err != nil {
		t.Fatalf("book ticket: %v", err)
	}
	layoutPayload["zones"].([]map[string]interface{})[0]["seatItems"] = []map[string]interface{}{
		{"id": fmt.Sprint(seats[1].SeatID), "name": "A2", "x": 135.0, "y": 210.0, "disabled": false},
	}
	jsonBytes, _ = json.Marshal(layoutPayload)
	replaceReq := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/venue-seat/concerts/%s/layout", testConcertID), bytes.NewReader(jsonBytes))
	replaceReq.Header.Set("Content-Type", "application/json")
	replaceResp, err := app.Test(replaceReq, -1)
	if err != nil || replaceResp.StatusCode != http.StatusConflict {
		t.Fatalf("expected booked seat replacement to return 409, status=%d error=%v", replaceResp.StatusCode, err)
	}
	clearReq := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/venue-seat/concerts/%s/layout", testConcertID), nil)
	clearResp, err := app.Test(clearReq, -1)
	if err != nil || clearResp.StatusCode != http.StatusConflict {
		t.Fatalf("expected booked layout clear to return 409, status=%d error=%v", clearResp.StatusCode, err)
	}

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

// Test 5: ระบบลงทะเบียนตรวจบัตร บันทึก GateCheckIn และป้องกันการใช้บัตรซ้ำ
func TestRegistrationCheckInAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	suffix := time.Now().UnixNano()
	concertID := fmt.Sprintf("reg-cc-%d", suffix)
	zoneID := fmt.Sprintf("reg-zone-%d", suffix)
	concert := models.Concert{
		ConcertID: concertID, ConcertName: "Registration Integration Concert",
		StartDate: "2026-12-20", EndDate: "2026-12-20", StartTime: "18:00:00", EndTime: "22:00:00",
		TimeOpenGate: "17:00:00", Location: "Test Hall", Status: "confirmed", MoreInfo: "registration test",
	}
	zone := models.Zone{
		ZoneID: zoneID, ConcertID: concertID, ZoneName: "VIP", ZoneType: "VIP", Capacity: 1,
		Color: "#e72d70", Shape: "rectangle", Width: 20, Height: 20,
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("create registration concert: %v", err)
	}
	if err := db.Create(&zone).Error; err != nil {
		t.Fatalf("create registration zone: %v", err)
	}
	seat := models.Seat{
		SeatRow: "A", SeatColumn: "1", StatusSeat: "available", ConcertID: concertID, ZoneID: zoneID,
	}
	if err := db.Create(&seat).Error; err != nil {
		t.Fatalf("create registration seat: %v", err)
	}
	ticket := models.Ticket{
		NameConcert: concert.ConcertName, TicketDateTime: time.Now(), PriceTicket: 2500,
		StatusTicket: "available", SeatID: seat.SeatID,
	}
	if err := db.Create(&ticket).Error; err != nil {
		t.Fatalf("create registration ticket: %v", err)
	}
	createdGateID := ""
	t.Cleanup(func() {
		db.Where("target_id = ?", formatTestTicketCode(ticket.TicketID)).Delete(&models.EmpActivityLogs{})
		db.Delete(&models.Ticket{}, ticket.TicketID)
		if createdGateID != "" {
			db.Delete(&models.GateCheckIn{}, "gate_id = ?", createdGateID)
		}
		db.Delete(&models.Seat{}, seat.SeatID)
		db.Delete(&models.Zone{}, "zone_id = ?", zoneID)
		db.Delete(&models.Concert{}, "concert_id = ?", concertID)
	})

	post := func(path string, payload any) (*http.Response, map[string]interface{}) {
		t.Helper()
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		result := map[string]interface{}{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		return resp, result
	}

	missingResp, missingResult := post("/api/registration/check-ins", map[string]string{"ticketCode": "TK-4294967295"})
	if missingResp.StatusCode != http.StatusNotFound || missingResult["result"] != "invalid" {
		t.Fatalf("missing ticket response: status=%d body=%#v", missingResp.StatusCode, missingResult)
	}

	ticketCode := formatTestTicketCode(ticket.TicketID)
	checkInResp, checkInResult := post("/api/registration/check-ins", map[string]string{"ticketCode": ticketCode})
	if checkInResp.StatusCode != http.StatusOK || checkInResult["result"] != "success" {
		t.Fatalf("check-in response: status=%d body=%#v", checkInResp.StatusCode, checkInResult)
	}
	var checkedInTicket models.Ticket
	if err := db.First(&checkedInTicket, ticket.TicketID).Error; err != nil {
		t.Fatal(err)
	}
	if checkedInTicket.GateID == nil || checkedInTicket.StatusTicket != "checked_in" {
		t.Fatalf("ticket was not marked checked in: %#v", checkedInTicket)
	}
	createdGateID = *checkedInTicket.GateID
	var gate models.GateCheckIn
	if err := db.First(&gate, "gate_id = ?", *checkedInTicket.GateID).Error; err != nil {
		t.Fatalf("GateCheckIn was not created: %v", err)
	}

	usedResp, usedResult := post("/api/registration/check-ins", map[string]string{"ticketCode": ticketCode})
	if usedResp.StatusCode != http.StatusConflict || usedResult["result"] != "used" {
		t.Fatalf("duplicate check-in response: status=%d body=%#v", usedResp.StatusCode, usedResult)
	}

	issueResp, issueResult := post("/api/registration/issues", map[string]string{"ticketCode": ticketCode, "result": "used"})
	if issueResp.StatusCode != http.StatusCreated || issueResult["logId"] == nil {
		t.Fatalf("issue report response: status=%d body=%#v", issueResp.StatusCode, issueResult)
	}
	var issueCount int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("target_id = ? AND action_type = ?", ticketCode, "REPORT_CHECK_IN_ISSUE").Count(&issueCount).Error; err != nil {
		t.Fatal(err)
	}
	if issueCount != 1 {
		t.Fatalf("issue log count: got %d, want 1", issueCount)
	}
}

func formatTestTicketCode(ticketID uint) string {
	return fmt.Sprintf("TK-%06d", ticketID)
}
