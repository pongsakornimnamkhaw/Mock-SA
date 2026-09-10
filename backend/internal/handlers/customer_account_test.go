package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm/clause"
)

func TestNormalizeCustomerEmail(t *testing.T) {
	value, err := normalizeCustomerEmail("  Customer@Example.COM ")
	if err != nil {
		t.Fatal(err)
	}
	if value != "customer@example.com" {
		t.Fatalf("unexpected normalized email: %q", value)
	}
	if _, err := normalizeCustomerEmail("invalid-email"); err == nil {
		t.Fatal("expected invalid email to be rejected")
	}
}

func TestValidateCustomerProfile(t *testing.T) {
	input, birthDate, err := validateCustomerProfile(customerProfileInput{
		FirstName: "  รันย์พัต  ", LastName: " ปิยธรรมโรจน์ ", DateOfBirth: "2005-08-26",
		Gender: "หญิง", Phone: " 0935480420 ", Email: "Customer@Example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if input.FirstName != "รันย์พัต" || input.Phone != "0935480420" || input.Email != "customer@example.com" {
		t.Fatalf("profile was not normalized: %#v", input)
	}
	if birthDate.Format("2006-01-02") != "2005-08-26" {
		t.Fatalf("unexpected birth date: %s", birthDate)
	}
}

func TestCustomerAccountViewDoesNotExposePassword(t *testing.T) {
	view := customerAccountView(models.User{
		UserID: "US_TEST", FirstName: "รันย์พัต", LastName: "ปิยธรรมโรจน์",
		DateOfBirth: time.Date(2005, 8, 26, 0, 0, 0, 0, time.UTC), Email: "customer@example.com",
		PasswordHash: "secret-hash",
	})
	if view.DateOfBirth != "2005-08-26" || view.Email != "customer@example.com" {
		t.Fatalf("unexpected account view: %#v", view)
	}
}

func TestCustomerSessionTokenIsHashed(t *testing.T) {
	token := strings.Repeat("a", 64)
	hash := hashCustomerSessionToken(token)
	if hash == token || len(hash) != 43 {
		t.Fatalf("session token was not hashed correctly: %q", hash)
	}
	if hash != hashCustomerSessionToken(token) {
		t.Fatal("session token hash must be deterministic")
	}
}

func TestCustomerAccountPostgreSQLFlow(t *testing.T) {
	db := managementTestDB(t)
	if db.Migrator().HasTable("customer_auth_sessions") {
		t.Fatal("obsolete customer_auth_sessions table still exists")
	}
	var tableCount int64
	if err := db.Raw(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`).Scan(&tableCount).Error; err != nil {
		t.Fatal(err)
	}
	if tableCount != 40 {
		t.Fatalf("migration created %d tables, expected the original 40", tableCount)
	}
	app := fiber.New()
	RegisterCustomerAccountRoutes(app, db)
	RegisterManagementRoutes(app, db)

	email := "customer.account@example.test"
	password := "SecurePass123!"
	registerBody := map[string]any{
		"first_name": "รันย์พัต", "last_name": "ปิยธรรมโรจน์", "date_of_birth": "2005-08-26",
		"gender": "หญิง", "phone": "0935480420", "address": "กรุงเทพมหานคร",
		"email": email, "password": password,
	}
	registerResponse := customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/register", registerBody, nil, http.StatusCreated)
	cookies := registerResponse.Cookies()
	if len(cookies) == 0 || cookies[0].Name != customerSessionCookie || !cookies[0].HttpOnly {
		t.Fatal("registration did not set an HttpOnly session cookie")
	}
	cookie := cookies[0]
	var accountPayload struct {
		Data customerAccountDTO `json:"data"`
	}
	decodeCustomerTestBody(t, registerResponse, &accountPayload)
	if accountPayload.Data.Email != email || accountPayload.Data.UserID == "" {
		t.Fatalf("unexpected registration response: %#v", accountPayload.Data)
	}

	var storedUser models.User
	if err := db.First(&storedUser, "user_id = ?", accountPayload.Data.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if storedUser.PasswordHash == password || !strings.HasPrefix(storedUser.PasswordHash, "$2") {
		t.Fatal("password was not stored as a bcrypt hash")
	}
	var storedSession models.CusActivityLogs
	if err := db.First(&storedSession, "user_id = ? AND action_type = ?", storedUser.UserID, customerSessionAction).Error; err != nil {
		t.Fatal(err)
	}
	if storedSession.TargetID == cookie.Value || len(storedSession.TargetID) != 43 {
		t.Fatal("raw session token was persisted")
	}
	expiresUnix, err := strconv.ParseInt(storedSession.Description, 10, 64)
	if err != nil || expiresUnix <= time.Now().UTC().Unix() {
		t.Fatal("session expiry was not stored correctly")
	}

	accountResponse := customerTestRequest(t, app, http.MethodGet, "/api/customer/account", nil, cookie, http.StatusOK)
	decodeCustomerTestBody(t, accountResponse, &accountPayload)
	if accountPayload.Data.FirstName != "รันย์พัต" {
		t.Fatalf("account was not loaded from PostgreSQL: %#v", accountPayload.Data)
	}

	profileBody := map[string]any{
		"first_name": "รันย์พัต", "last_name": "ทดสอบแก้ไข", "date_of_birth": "2005-08-26",
		"gender": "หญิง", "phone": "0812345678", "address": "เชียงใหม่", "email": email,
	}
	profileResponse := customerTestRequest(t, app, http.MethodPatch, "/api/customer/account/profile", profileBody, cookie, http.StatusOK)
	decodeCustomerTestBody(t, profileResponse, &accountPayload)
	if accountPayload.Data.LastName != "ทดสอบแก้ไข" || accountPayload.Data.Phone != "0812345678" {
		t.Fatalf("profile update was not persisted: %#v", accountPayload.Data)
	}

	concert := models.Concert{ConcertID: "CUSTOMER_TEST_CONCERT", ConcertName: "คอนเสิร์ตทดสอบ", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "สถานที่ทดสอบ", Status: "ยืนยันแล้ว"}
	zone := models.Zone{ZoneID: "CUSTOMER_TEST_ZONE", ZoneType: "VIP", Capacity: 10}
	promotion := models.Promotion{PromotionID: "CUSTOMER_TEST_PROMOTION", PromotionName: "ไม่มีโปรโมชั่น", Description: "ใช้สำหรับทดสอบ", BannerImageUrl: []byte{}, Status: "active", ZoneType: zone.ZoneType, ConcertID: concert.ConcertID}
	seat := models.Seat{SeatID: "CUSTOMER_TEST_SEAT", SeatRow: "A", SeatColumn: "2", StatusSeat: "ไม่ว่าง", ConcertID: concert.ConcertID, ZoneID: zone.ZoneID}
	booking := models.Booking{BookingID: "CUSTOMER_TEST_BOOKING", BookingDate: time.Now().UTC(), Status: "สำเร็จ", UserID: &storedUser.UserID}
	for _, row := range []any{
		&concert,
		&zone,
		&promotion,
		&models.TicketCategory{CategoryID: "CUSTOMER_TEST_CATEGORY", CategoryName: "VIP", Price: 2500, Quantity: 10, PromotionName: promotion.PromotionName, PromotionID: promotion.PromotionID, ZoneID: zone.ZoneID},
		&seat,
		&booking,
		&models.Payment{PaymentID: "CUSTOMER_TEST_PAYMENT", EvidenceFile: []byte{}, PaymentStatus: "ชำระเงินแล้ว", BookingID: booking.BookingID},
		&models.Ticket{TicketID: "CUSTOMER_TEST_TICKET", NameConcert: concert.ConcertName, TicketDateTime: time.Now().UTC(), StatusTicket: "พร้อมใช้งาน", SeatID: seat.SeatID, BookingID: booking.BookingID},
	} {
		if err := db.Omit(clause.Associations).Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	ticketsResponse := customerTestRequest(t, app, http.MethodGet, "/api/customer/account/tickets", nil, cookie, http.StatusOK)
	var ticketsPayload struct {
		Data []customerTicketDTO `json:"data"`
	}
	decodeCustomerTestBody(t, ticketsResponse, &ticketsPayload)
	if len(ticketsPayload.Data) != 1 || ticketsPayload.Data[0].TicketID != "CUSTOMER_TEST_TICKET" {
		t.Fatalf("unexpected tickets response: %#v", ticketsPayload.Data)
	}
	purchasesResponse := customerTestRequest(t, app, http.MethodGet, "/api/customer/account/purchases", nil, cookie, http.StatusOK)
	var purchasesPayload struct {
		Data []customerPurchaseDTO `json:"data"`
	}
	decodeCustomerTestBody(t, purchasesResponse, &purchasesPayload)
	if len(purchasesPayload.Data) != 1 || purchasesPayload.Data[0].TicketCount != 1 || purchasesPayload.Data[0].TotalAmount != 2500 {
		t.Fatalf("unexpected purchases response: %#v", purchasesPayload.Data)
	}

	passwordResponse := customerTestRequest(t, app, http.MethodPatch, "/api/customer/account/password", map[string]string{
		"current_password": password, "new_password": "NewSecurePass456!",
	}, cookie, http.StatusNoContent)
	passwordResponse.Body.Close()
	logoutResponse := customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/logout", nil, cookie, http.StatusNoContent)
	logoutResponse.Body.Close()
	unauthorizedResponse := customerTestRequest(t, app, http.MethodGet, "/api/customer/account", nil, cookie, http.StatusUnauthorized)
	unauthorizedResponse.Body.Close()

	loginResponse := customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login", map[string]string{
		"email": email, "password": "NewSecurePass456!",
	}, nil, http.StatusOK)
	if len(loginResponse.Cookies()) == 0 {
		t.Fatal("login did not create a session")
	}
	loginResponse.Body.Close()

	activityResponse := customerTestRequest(t, app, http.MethodGet, "/api/activity-logs?type=user", nil, nil, http.StatusOK)
	var activityPayload struct {
		Data []struct {
			ActionCode string `json:"action_code"`
		} `json:"data"`
	}
	decodeCustomerTestBody(t, activityResponse, &activityPayload)
	for _, activity := range activityPayload.Data {
		if activity.ActionCode == customerSessionAction {
			t.Fatal("private authentication session leaked into the customer activity history")
		}
	}
}

func customerTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, cookie *http.Cookie, expectedStatus int) *http.Response {
	t.Helper()
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}
	request := httptest.NewRequest(method, path, body)
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response, err := app.Test(request, -1)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != expectedStatus {
		defer response.Body.Close()
		content, _ := io.ReadAll(response.Body)
		t.Fatalf("%s %s returned %d, expected %d: %s", method, path, response.StatusCode, expectedStatus, content)
	}
	return response
}

func decodeCustomerTestBody(t *testing.T, response *http.Response, target any) {
	t.Helper()
	defer response.Body.Close()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}
