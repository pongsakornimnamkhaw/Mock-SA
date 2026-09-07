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

	// Clean up test data
	t.Cleanup(func() {
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueSeatRound{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueSeatPlan{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueSeatPublication{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.Concert{})
	})
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

	// Clean up
	t.Cleanup(func() {
		db.Where("zone_id = ?", "zone-vip-1").Delete(&models.VenueSeat{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueSeatZone{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueLayoutObject{})
		db.Where("concert_id = ?", testConcertID).Delete(&models.VenueSeatPlan{})
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
