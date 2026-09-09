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

// Test 2: ทดสอบยิง POST /api/venue-seat/concerts เพื่อสร้าง Concert เข้า DB จริง
func TestCreateAndGetConcertAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)

	testConcertID := fmt.Sprintf("test-cc-%d", time.Now().UnixNano())
	t.Cleanup(func() {
		db.Where("concert_id = ?", testConcertID).Delete(&models.PerformanceSchedule{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Publication{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})
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
			"scheduleImage": "data:image/png;base64,web-poster",
			"description":   "Public ticket-sale description",
			"saleStart":     "2026-09-01T10:00",
			"saleEnd":       "2026-10-15T18:00",
			"publishAt":     "2026-08-01T09:00",
			"unpublishAt":   "2026-10-17T00:00",
		},
	}

	jsonBytes, _ := json.Marshal(payload)

	// POST /api/venue-seat/concerts
	req := httptest.NewRequest(http.MethodPost, "/api/venue-seat/concerts", bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("POST concerts request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Expected status 200 on POST, got %d, body: %s", resp.StatusCode, string(body))
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
	publishing, ok := concertRes["publishing"].(map[string]interface{})
	if !ok {
		t.Fatalf("publishing response has type %T, want object", concertRes["publishing"])
	}
	if publishing["description"] != "Public ticket-sale description" {
		t.Errorf("publishing description = %v, want persisted public description", publishing["description"])
	}
	if publishing["scheduleImage"] != "data:image/png;base64,web-poster" {
		t.Errorf("publishing scheduleImage = %v, want persisted web poster", publishing["scheduleImage"])
	}
	var scheduleCount, publicationCount int64
	if err := db.Model(&models.PerformanceSchedule{}).Where("concert_id = ?", testConcertID).Count(&scheduleCount).Error; err != nil {
		t.Fatalf("count performance schedules: %v", err)
	}
	if err := db.Model(&models.Publication{}).Where("concert_id = ?", testConcertID).Count(&publicationCount).Error; err != nil {
		t.Fatalf("count publication: %v", err)
	}
	if scheduleCount != 0 || publicationCount != 1 {
		t.Fatalf("saved performance schedules/publications = %d/%d, want 0/1; venue-seat planning must not create PerformanceSchedule rows", scheduleCount, publicationCount)
	}

}

// Test 3: ทดสอบยิง PUT /api/venue-seat/concerts/:id/layout บันทึก Layout
func TestSaveLayoutAPI(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	var categoryCountBefore int64
	if err := db.Model(&models.TicketCategory{}).Count(&categoryCountBefore).Error; err != nil {
		t.Fatalf("count external ticket categories before layout save: %v", err)
	}

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
	t.Cleanup(func() {
		db.Where("concert_id = ?", testConcertID).Delete(&models.LayoutObject{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Seat{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Zone{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})

	layoutPayload := map[string]interface{}{
		"zones": []map[string]interface{}{
			{
				"id":     "zone-" + testConcertID,
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
					{"id": "seat-a1-" + testConcertID, "name": "A1", "x": 105.0, "y": 210.0, "disabled": false},
					{"id": "seat-a2-" + testConcertID, "name": "A2", "x": 135.0, "y": 210.0, "disabled": false},
				},
			},
		},
		"layoutObjects": []map[string]interface{}{
			{
				"id":        "obj-stage-" + testConcertID,
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
		"ticketLayoutObjects": []map[string]interface{}{
			{
				"id": "ticket-title-" + testConcertID, "kind": "text", "name": "CONCERT NAME",
				"color": "#ffffff", "textColor": "#ffffff", "x": 35.0, "y": 25.0,
				"width": 30.0, "height": 10.0, "rotation": 0.0, "z": 1,
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

	var zoneCount, seatCount, categoryCount, objectCount, ticketObjectCount int64
	db.Model(&models.Zone{}).Where("concert_id = ?", testConcertID).Count(&zoneCount)
	db.Model(&models.Seat{}).Where("concert_id = ?", testConcertID).Count(&seatCount)
	db.Model(&models.TicketCategory{}).Count(&categoryCount)
	db.Model(&models.LayoutObject{}).Where("concert_id = ? AND layout_type = ?", testConcertID, "VENUE").Count(&objectCount)
	db.Model(&models.LayoutObject{}).Where("concert_id = ? AND layout_type = ?", testConcertID, "TICKET").Count(&ticketObjectCount)
	if zoneCount != 1 || seatCount != 2 || categoryCount != categoryCountBefore || objectCount != 1 || ticketObjectCount != 1 {
		t.Fatalf("saved zone/seat/category/venue-object/ticket-object counts = %d/%d/%d/%d/%d, want 1/2/%d/1/1", zoneCount, seatCount, categoryCount, objectCount, ticketObjectCount, categoryCountBefore)
	}

	getReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/venue-seat/concerts/%s", testConcertID), nil)
	getResp, err := app.Test(getReq, -1)
	if err != nil || getResp.StatusCode != http.StatusOK {
		t.Fatalf("GET saved layout failed: status=%d err=%v", getResp.StatusCode, err)
	}
	var saved map[string]interface{}
	if err := json.NewDecoder(getResp.Body).Decode(&saved); err != nil {
		t.Fatalf("decode saved layout: %v", err)
	}
	if len(saved["zones"].([]interface{})) != 1 || len(saved["layoutObjects"].([]interface{})) != 1 || len(saved["ticketLayoutObjects"].([]interface{})) != 1 {
		t.Fatalf("GET did not preserve layout JSON shape: %#v", saved)
	}

}

func TestSaveLayoutRollsBackOnInvalidZone(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	concertID := fmt.Sprintf("test-layout-invalid-%d", time.Now().UnixNano())
	concert := models.Concert{
		ConcertID: concertID, ConcertName: "Invalid Layout Test", StartDate: "2026-09-07",
		EndDate: "2026-09-07", StartTime: "18:00:00", EndTime: "20:00:00",
		Location: "Hall", Status: "Draft", MoreInfo: "test",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("create concert: %v", err)
	}
	t.Cleanup(func() {
		db.Where("concert_id = ?", concertID).Delete(&models.LayoutObject{})
		db.Where("concert_id = ?", concertID).Delete(&models.Seat{})
		db.Where("concert_id = ?", concertID).Delete(&models.Zone{})
		db.Where("concert_id = ?", concertID).Delete(&models.Concert{})
	})

	payload := map[string]interface{}{
		"zones": []map[string]interface{}{
			{"id": "valid-zone", "name": "A", "seats": 1, "price": 500, "type": "SEATED", "shape": "rect", "color": "#fff"},
			{"id": "invalid-zone", "name": "B", "seats": 1, "price": -1, "type": "SEATED", "shape": "rect", "color": "#000"},
		},
		"layoutObjects": []map[string]interface{}{},
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/api/venue-seat/concerts/%s/layout", concertID), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("PUT invalid layout: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		responseBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want 400: %s", resp.StatusCode, responseBody)
	}
	var count int64
	db.Model(&models.Zone{}).Where("concert_id = ?", concertID).Count(&count)
	if count != 0 {
		t.Fatalf("invalid layout persisted %d zones, want 0", count)
	}
}

func TestLookupTicketDoesNotMutateRegistration(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "VALID")

	req := httptest.NewRequest(http.MethodGet, "/api/event-registration/tickets/"+ticket.TicketID, nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("lookup ticket: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("lookup status = %d, want 200: %s", resp.StatusCode, body)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode lookup: %v", err)
	}
	if result["ticketId"] != ticket.TicketID || result["checkedIn"] != false {
		t.Fatalf("unexpected lookup response: %#v", result)
	}
	var count int64
	db.Model(&models.GateCheckIn{}).Where("ticket_id = ?", ticket.TicketID).Count(&count)
	if count != 0 {
		t.Fatalf("GET created %d check-ins, want 0", count)
	}
}

func TestCheckInUsesTicketOnlyOnce(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "READY")
	body, _ := json.Marshal(map[string]interface{}{"ticketId": ticket.TicketID, "gateId": 1})

	request := func() *http.Response {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/event-registration/check-ins", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, err := app.Test(req, -1)
		if err != nil {
			t.Fatalf("check in: %v", err)
		}
		return resp
	}
	if resp := request(); resp.StatusCode != http.StatusCreated {
		responseBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("first check-in status = %d, want 201: %s", resp.StatusCode, responseBody)
	}
	if resp := request(); resp.StatusCode != http.StatusConflict {
		responseBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("second check-in status = %d, want 409: %s", resp.StatusCode, responseBody)
	}

	var count int64
	db.Model(&models.GateCheckIn{}).Where("ticket_id = ?", ticket.TicketID).Count(&count)
	if count != 1 {
		t.Fatalf("check-in count = %d, want 1", count)
	}
	var saved models.Ticket
	db.First(&saved, "ticket_id = ?", ticket.TicketID)
	if saved.StatusTicket != "USED" {
		t.Fatalf("ticket status = %q, want USED", saved.StatusTicket)
	}
}

func TestCheckInRejectsInvalidGate(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "ACTIVE")
	body, _ := json.Marshal(map[string]interface{}{"ticketId": ticket.TicketID, "gateId": 0})
	req := httptest.NewRequest(http.MethodPost, "/api/event-registration/check-ins", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("invalid gate request: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid gate status = %d, want 400", resp.StatusCode)
	}
}

func TestRegistrationDashboardAggregatesConcertCheckIns(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "USED")
	var seat models.Seat
	if err := db.First(&seat, "seat_id = ?", ticket.SeatID).Error; err != nil {
		t.Fatalf("load registration seat: %v", err)
	}
	entry := models.GateCheckIn{TicketID: ticket.TicketID, GateID: 2, GateDateTime: time.Now(), CheckInStatus: "SUCCESS"}
	if err := db.Create(&entry).Error; err != nil {
		t.Fatalf("create check-in: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/event-registration/concerts/"+seat.ConcertID+"/dashboard", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("registration dashboard: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("dashboard status = %d, want 200: %s", resp.StatusCode, body)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode dashboard: %v", err)
	}
	if result["totalTickets"] != float64(1) || result["checkedIn"] != float64(1) || result["remaining"] != float64(0) {
		t.Fatalf("unexpected dashboard counts: %#v", result)
	}
	gates, ok := result["gates"].([]interface{})
	if !ok || len(gates) != 4 {
		t.Fatalf("dashboard gates = %#v, want four gates", result["gates"])
	}
	recent, ok := result["recent"].([]interface{})
	if !ok || len(recent) != 1 {
		t.Fatalf("dashboard recent = %#v, want one row", result["recent"])
	}
}

func TestLookupUsedTicketReturnsConflictDetails(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "USED")
	entry := models.GateCheckIn{TicketID: ticket.TicketID, GateID: 1, GateDateTime: time.Now(), CheckInStatus: "SUCCESS"}
	if err := db.Create(&entry).Error; err != nil {
		t.Fatalf("create used check-in: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/event-registration/tickets/"+ticket.TicketID, nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("lookup used ticket: %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("used lookup status = %d, want 409: %s", resp.StatusCode, body)
	}
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode used lookup: %v", err)
	}
	if result["ticketId"] != ticket.TicketID || result["checkedIn"] != true {
		t.Fatalf("used lookup did not return ticket details: %#v", result)
	}
}

func TestTicketImageCanBeStoredAndLoaded(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "VALID")
	image := []byte("\x89PNG\r\n\x1a\nmock-ticket-image")

	put := httptest.NewRequest(http.MethodPut, "/api/event-registration/tickets/"+ticket.TicketID+"/image", bytes.NewReader(image))
	put.Header.Set("Content-Type", "image/png")
	putResponse, err := app.Test(put, -1)
	if err != nil {
		t.Fatalf("store ticket image: %v", err)
	}
	if putResponse.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(putResponse.Body)
		t.Fatalf("store ticket image status = %d, want 204: %s", putResponse.StatusCode, body)
	}

	get := httptest.NewRequest(http.MethodGet, "/api/event-registration/tickets/"+ticket.TicketID+"/image", nil)
	getResponse, err := app.Test(get, -1)
	if err != nil {
		t.Fatalf("load ticket image: %v", err)
	}
	if getResponse.StatusCode != http.StatusOK || getResponse.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("load ticket image response = %d %q, want 200 image/png", getResponse.StatusCode, getResponse.Header.Get("Content-Type"))
	}
	got, _ := io.ReadAll(getResponse.Body)
	if !bytes.Equal(got, image) {
		t.Fatalf("ticket image bytes = %q, want %q", got, image)
	}
	lookup := httptest.NewRequest(http.MethodGet, "/api/event-registration/tickets/"+ticket.TicketID, nil)
	lookupResponse, err := app.Test(lookup, -1)
	if err != nil {
		t.Fatalf("lookup ticket with image: %v", err)
	}
	var ticketDetails map[string]any
	if err := json.NewDecoder(lookupResponse.Body).Decode(&ticketDetails); err != nil {
		t.Fatalf("decode ticket details: %v", err)
	}
	wantURL := "/api/event-registration/tickets/" + ticket.TicketID + "/image"
	if ticketDetails["ticketImageUrl"] != wantURL {
		t.Fatalf("ticketImageUrl = %#v, want %q", ticketDetails["ticketImageUrl"], wantURL)
	}
}

func TestSeatLayoutImageCanBeStoredAndLoaded(t *testing.T) {
	db := setupTestDB(t)
	app := setupTestApp(db)
	ticket := createRegistrationFixture(t, db, "VALID")
	var seat models.Seat
	if err := db.First(&seat, "seat_id = ?", ticket.SeatID).Error; err != nil {
		t.Fatalf("load registration seat: %v", err)
	}
	image := []byte("\x89PNG\r\n\x1a\nmock-seat-layout")

	put := httptest.NewRequest(http.MethodPut, "/api/venue-seat/concerts/"+seat.ConcertID+"/seat-layout-image", bytes.NewReader(image))
	put.Header.Set("Content-Type", "image/png")
	putResponse, err := app.Test(put, -1)
	if err != nil {
		t.Fatalf("store seat layout image: %v", err)
	}
	if putResponse.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(putResponse.Body)
		t.Fatalf("store seat layout image status = %d, want 204: %s", putResponse.StatusCode, body)
	}

	get := httptest.NewRequest(http.MethodGet, "/api/venue-seat/concerts/"+seat.ConcertID+"/seat-layout-image", nil)
	getResponse, err := app.Test(get, -1)
	if err != nil {
		t.Fatalf("load seat layout image: %v", err)
	}
	if getResponse.StatusCode != http.StatusOK || getResponse.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("load seat layout image response = %d %q, want 200 image/png", getResponse.StatusCode, getResponse.Header.Get("Content-Type"))
	}
	got, _ := io.ReadAll(getResponse.Body)
	if !bytes.Equal(got, image) {
		t.Fatalf("seat layout image bytes = %q, want %q", got, image)
	}
	concertRequest := httptest.NewRequest(http.MethodGet, "/api/venue-seat/concerts/"+seat.ConcertID, nil)
	concertResponse, err := app.Test(concertRequest, -1)
	if err != nil {
		t.Fatalf("load concert with seat layout image: %v", err)
	}
	var concertDetails map[string]any
	if err := json.NewDecoder(concertResponse.Body).Decode(&concertDetails); err != nil {
		t.Fatalf("decode concert details: %v", err)
	}
	wantURL := "/api/venue-seat/concerts/" + seat.ConcertID + "/seat-layout-image"
	if concertDetails["seatLayoutImageUrl"] != wantURL {
		t.Fatalf("seatLayoutImageUrl = %#v, want %q", concertDetails["seatLayoutImageUrl"], wantURL)
	}
}

func createRegistrationFixture(t *testing.T, db *gorm.DB, status string) models.Ticket {
	t.Helper()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	concertID, zoneID, seatID, bookingID := "CC-"+suffix, "ZN-"+suffix, "ST-"+suffix, "BK-"+suffix
	concert := models.Concert{ConcertID: concertID, ConcertName: "Registration Test", StartDate: "2026-09-07", EndDate: "2026-09-07", StartTime: "18:00:00", EndTime: "20:00:00", Location: "Hall", Status: "ACTIVE", MoreInfo: "test"}
	zone := models.Zone{ZoneID: zoneID, ConcertID: concertID, ZoneType: "A", Capacity: 1, Shape: "rect", Color: "#fff"}
	seat := models.Seat{SeatID: seatID, ConcertID: concertID, ZoneID: zoneID, SeatRow: "A", SeatColumn: "1", StatusSeat: "AVAILABLE"}
	booking := models.Booking{BookingID: bookingID, BookingDate: time.Now(), Status: "PAID"}
	ticket := models.Ticket{TicketID: "TK-" + suffix, NameConcert: concert.ConcertName, TicketDateTime: time.Now(), PriceTicket: 500, StatusTicket: status, SeatID: seatID, BookingID: bookingID}
	for _, model := range []interface{}{&concert, &zone, &seat, &booking, &ticket} {
		if err := db.Create(model).Error; err != nil {
			t.Fatalf("create registration fixture %T: %v", model, err)
		}
	}
	t.Cleanup(func() {
		db.Where("ticket_id = ?", ticket.TicketID).Delete(&models.GateCheckIn{})
		db.Where("ticket_id = ?", ticket.TicketID).Delete(&models.Ticket{})
		db.Where("booking_id = ?", bookingID).Delete(&models.Booking{})
		db.Where("seat_id = ?", seatID).Delete(&models.Seat{})
		db.Where("zone_id = ?", zoneID).Delete(&models.Zone{})
		db.Where("concert_id = ?", concertID).Delete(&models.Concert{})
	})
	return ticket
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
