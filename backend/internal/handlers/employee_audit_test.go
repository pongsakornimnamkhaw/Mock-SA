package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Removing the optional-auth guard would panic on nil DB or replace the public
// route response; propagating handler errors is part of this middleware's contract.
func TestEmployeeAuditPreservesResponsesWithoutValidSession(t *testing.T) {
	for _, token := range []string{"", "invalid-session"} {
		for _, status := range []int{200, 201, 204, 302, 400, 500} {
			app := fiber.New()
			RegisterEmployeeAuditMiddleware(app, nil)
			app.Post("/api/artists", func(c *fiber.Ctx) error {
				c.Set("X-Original", "preserved")
				return c.Status(status).SendString("original response")
			})
			request := httptest.NewRequest("POST", "/api/artists", nil)
			if token != "" {
				request.AddCookie(&http.Cookie{Name: employeeSessionCookie, Value: token})
			}
			response, err := app.Test(request)
			if err != nil {
				t.Fatal(err)
			}
			body, err := io.ReadAll(response.Body)
			response.Body.Close()
			if err != nil {
				t.Fatal(err)
			}
			if response.StatusCode != status || response.Header.Get("X-Original") != "preserved" || (status != 204 && string(body) != "original response") {
				t.Fatalf("middleware changed unauthenticated response: %d %q", response.StatusCode, body)
			}
		}
	}
	app := fiber.New()
	RegisterEmployeeAuditMiddleware(app, nil)
	app.Put("/api/concerts/:id", func(c *fiber.Ctx) error { return fiber.ErrConflict })
	employeeAccountTestRequest(t, app, "PUT", "/api/concerts/failure", nil, nil, 409).Body.Close()
}

func newEmployeeAuditTestApp(t *testing.T, db *gorm.DB) (*fiber.App, *http.Cookie, models.User) {
	t.Helper()
	app := fiber.New()
	RegisterEmployeeAuditMiddleware(app, db)
	RegisterEmployeeAuthRoutes(app, db)
	RegisterArtistRoutes(app, db)
	RegisterManagementRoutes(app, db)
	RegisterBookingPaymentRoutes(app, db)
	auth := &employeeAuthHandler{db: db}
	app.Post("/__test/employee-session/:userID", func(c *fiber.Ctx) error {
		return auth.startSession(c, c.Params("userID"))
	})
	user := employeeAccountTestUser(t, db, "AUDIT_ACTOR", models.PersonnelTypeInternal, "audit@example.test", "0811111111", "AuditPass123!")
	return app, startEmployeeAccountTestSession(t, app, user.UserID), user
}

func employeeAuditTestRows(t *testing.T, db *gorm.DB) []models.EmpActivityLogs {
	t.Helper()
	var rows []models.EmpActivityLogs
	if err := db.Where("action_type <> ?", employeeSessionAction).Order("created_at, emp_log_id").Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestEmployeeAuditRecordsSuccessfulMutationsOnce(t *testing.T) {
	db := managementTestDB(t)
	app, cookie, user := newEmployeeAuditTestApp(t, db)
	artist := map[string]string{"artist_name": "Audit artist", "record_label": "Label", "official_contact": "Contact", "coordinator_name": "Coordinator", "coordinator_phone": "0811111111", "coordinator_email": "artist@example.test"}
	response := employeeAccountTestRequest(t, app, "POST", "/api/artists", artist, cookie, 201)
	var created models.Artist
	decodeEmployeeAccountTestBody(t, response, &created)
	rows := employeeAuditTestRows(t, db)
	if len(rows) != 1 || rows[0].UserID == nil || *rows[0].UserID != user.UserID || rows[0].ActionType != "เพิ่ม" || rows[0].Module != "ศิลปิน" {
		t.Fatalf("expected one artist create row for session actor: %#v", rows)
	}
	for _, test := range []struct {
		payload any
		cookie  *http.Cookie
		status  int
	}{
		{map[string]string{}, cookie, 400},
		{artist, nil, 201},
		{artist, &http.Cookie{Name: employeeSessionCookie, Value: "invalid-session"}, 201},
	} {
		employeeAccountTestRequest(t, app, "POST", "/api/artists", test.payload, test.cookie, test.status).Body.Close()
	}
	if rows := employeeAuditTestRows(t, db); len(rows) != 1 {
		t.Fatalf("failed/anonymous/invalid-session requests wrote audit rows: %#v", rows)
	}
	employeeAccountTestRequest(t, app, "DELETE", "/api/artists/"+created.ArtistID, nil, cookie, 200).Body.Close()
	rows = employeeAuditTestRows(t, db)
	if len(rows) != 2 || rows[1].TargetID != created.ArtistID || rows[1].ActionType != "ลบ" {
		t.Fatalf("delete target not recorded: %#v", rows)
	}
	// Middleware must preserve returned errors even before Fiber formats their status.
	app.Put("/api/concerts/:id", func(c *fiber.Ctx) error { return fiber.ErrBadRequest })
	employeeAccountTestRequest(t, app, "PUT", "/api/concerts/failed", nil, cookie, 400).Body.Close()
	if len(employeeAuditTestRows(t, db)) != 2 {
		t.Fatal("returned error created an audit row")
	}
}

func TestEmployeeAuditDoesNotDuplicateExistingManagementLog(t *testing.T) {
	db := managementTestDB(t)
	app, cookie, user := newEmployeeAuditTestApp(t, db)
	concert := models.Concert{ConcertID: "AUDIT_CONCERT", ConcertName: "Audit concert", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "Test", Status: "ยืนยันแล้ว"}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		id     string
		cookie *http.Cookie
	}{{"AUDIT_PROMO", cookie}, {"ANON_PROMO", nil}} {
		promotion := models.Promotion{PromotionID: test.id, PromotionName: "Audit promotion", ConcertID: concert.ConcertID, Status: "draft", BannerImageUrl: []byte{}}
		if err := db.Create(&promotion).Error; err != nil {
			t.Fatal(err)
		}
		employeeAccountTestRequest(t, app, "DELETE", "/api/promotions/"+test.id, nil, test.cookie, 204).Body.Close()
	}
	rows := employeeAuditTestRows(t, db)
	if len(rows) != 2 || rows[0].UserID == nil || *rows[0].UserID != user.UserID || rows[0].Module != "โปรโมชั่น" || rows[0].ActionType != "DELETE_PROMOTION" || !strings.Contains(rows[0].Description, "Audit promotion") || rows[1].UserID != nil {
		t.Fatalf("rich management attribution/anonymous behavior changed or duplicated: %#v", rows)
	}
	response := employeeAccountTestRequest(t, app, "GET", "/api/employee/account/activity", nil, cookie, 200)
	var activity struct {
		Data  []models.EmpActivityLogs `json:"data"`
		Total int64                    `json:"total"`
	}
	decodeEmployeeAccountTestBody(t, response, &activity)
	if activity.Total != 1 || len(activity.Data) != 1 {
		t.Fatalf("expected one visible actor activity row: %#v", activity)
	}
	// A failed management mutation contributes no generic or rich row.
	employeeAccountTestRequest(t, app, "DELETE", "/api/promotions/missing", nil, cookie, 404).Body.Close()
	if len(employeeAuditTestRows(t, db)) != 2 {
		t.Fatal("failed management mutation was audited")
	}
}

func TestEmployeeAuditAttributesBookingDecisionsOnce(t *testing.T) {
	db := managementTestDB(t)
	app, cookie, user := newEmployeeAuditTestApp(t, db)
	booking := models.Booking{BookingID: "AUDIT_BOOKING", Status: "under_review", BookingDate: time.Now(), CustomerName: "Customer"}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	employeeAccountTestRequest(t, app, "POST", "/api/sales/bookings/AUDIT_BOOKING/reject", map[string]string{"reason": "Invalid slip", "officer_name": "untrusted name"}, cookie, 200).Body.Close()
	employeeAccountTestRequest(t, app, "POST", "/api/sales/bookings/AUDIT_BOOKING/reject", map[string]string{}, cookie, 400).Body.Close()
	rows := employeeAuditTestRows(t, db)
	if len(rows) != 1 || rows[0].UserID == nil || *rows[0].UserID != user.UserID || rows[0].Module != "การจอง" || rows[0].ActionType != "ปฏิเสธการชำระเงิน" || !strings.Contains(rows[0].Description, "Invalid slip") {
		t.Fatalf("expected one rich booking decision for session actor: %#v", rows)
	}
	employeeAccountTestRequest(t, app, "POST", "/api/sales/bookings/AUDIT_BOOKING/reject", map[string]string{"reason": "Anonymous"}, nil, 200).Body.Close()
	rows = employeeAuditTestRows(t, db)
	if len(rows) != 2 || rows[1].UserID != nil {
		t.Fatalf("anonymous booking behavior changed: %#v", rows)
	}
	concert := models.Concert{ConcertID: "C001", ConcertName: "Audit concert", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "Test", Status: "ยืนยันแล้ว"}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	employeeAccountTestRequest(t, app, "POST", "/api/sales/bookings/AUDIT_BOOKING/approve", nil, cookie, 200).Body.Close()
	employeeAccountTestRequest(t, app, "POST", "/api/sales/bookings/AUDIT_BOOKING/resend", nil, cookie, 200).Body.Close()
	// The shared customer resend handler retains its existing anonymous activity,
	// even when a browser also happens to hold an employee session cookie.
	employeeAccountTestRequest(t, app, "POST", "/api/bookings/AUDIT_BOOKING/resend-tickets", nil, cookie, 200).Body.Close()
	rows = employeeAuditTestRows(t, db)
	if len(rows) != 5 {
		t.Fatalf("booking approve/resend created duplicate rows: %#v", rows)
	}
	for i, action := range []string{"อนุมัติการชำระเงิน", "ขอส่งบัตรซ้ำ"} {
		row := rows[i+2]
		if row.UserID == nil || *row.UserID != user.UserID || row.ActionType != action || row.Module != "การจอง" {
			t.Fatalf("sales activity has wrong attribution: %#v", row)
		}
	}
	if rows[4].UserID != nil {
		t.Fatal("customer resend was attributed as employee activity")
	}
}

func TestEmployeeAuditMetadataCoversOnlyEmployeeMutations(t *testing.T) {
	for _, test := range []struct{ method, path, action, module string }{
		{"POST", "/api/artists", "เพิ่ม", "ศิลปิน"},
		{"PUT", "/api/artists/A1/invitations", "แก้ไข", "ศิลปิน"},
		{"DELETE", "/api/artists/A1", "ลบ", "ศิลปิน"},
		{"POST", "/api/concerts", "เพิ่ม", "คอนเสิร์ต"},
		{"PATCH", "/api/concerts/C1/status", "แก้ไข", "คอนเสิร์ต"},
		{"POST", "/api/concerts/C1/tasks", "เพิ่ม", "แผนงาน"},
		{"PUT", "/api/tasks/T1/status", "แก้ไข", "แผนงาน"},
		{"PATCH", "/api/tasks/T1/status", "แก้ไข", "แผนงาน"},
		{"PUT", "/api/concerts/C1/tasks/T1/status", "แก้ไข", "แผนงาน"},
		{"POST", "/api/concerts/C1/documents", "เพิ่ม", "คอนเสิร์ต"},
		{"DELETE", "/api/documents/D1", "ลบ", "คอนเสิร์ต"},
		{"POST", "/api/performance-schedules", "แก้ไข", "ตารางการแสดง"},
		{"PUT", "/api/concerts/C1/performance-schedules", "แก้ไข", "ตารางการแสดง"},
		{"POST", "/api/performance-details", "เพิ่ม", "ตารางการแสดง"},
		{"POST", "/api/artist-requirements", "เพิ่ม", "ความต้องการศิลปิน"},
		{"PUT", "/api/work-plans/current", "แก้ไข", "แผนงาน"},
		{"POST", "/api/work-plans/current/submit", "ส่งแผนงาน", "แผนงาน"},
	} {
		action, module, ok := employeeAuditMetadata(test.method, test.path)
		if !ok || action != test.action || module != test.module {
			t.Errorf("%s %s = %q %q %v", test.method, test.path, action, module, ok)
		}
	}
	for _, test := range []struct{ method, path string }{
		{"GET", "/api/artists"}, {"OPTIONS", "/api/artists"}, {"POST", "/api/artists/A1/unknown"},
		{"POST", "/api/employee/auth/login"}, {"POST", "/api/employee/auth/logout"},
		{"PATCH", "/api/employee/account/profile"}, {"PATCH", "/api/employee/account/password"},
		{"POST", "/api/employee/password-reset/request"}, {"POST", "/api/customer/account/login"},
		{"POST", "/api/bookings"}, {"POST", "/api/bookings/B1/reupload-slip"}, {"POST", "/api/bookings/B1/resend-tickets"},
		{"POST", "/api/promotions"}, {"PUT", "/api/promotions/P1"}, {"DELETE", "/api/promotions/P1"},
		{"PATCH", "/api/promotion-approvals/P1"}, {"POST", "/api/employees"}, {"PUT", "/api/employees/U1"}, {"DELETE", "/api/employees/U1"},
		{"POST", "/api/sales/bookings/B1/approve"}, {"POST", "/api/sales/bookings/B1/reject"}, {"POST", "/api/sales/bookings/B1/resend"},
	} {
		if _, _, ok := employeeAuditMetadata(test.method, test.path); ok {
			t.Errorf("unexpected generic audit for %s %s", test.method, test.path)
		}
	}
}
