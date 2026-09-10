package handlers

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const resetPublicPath = "/api/employee/auth/password-reset"
const resetAdminPath = "/api/employee/password-reset-requests"

func TestEmployeePasswordResetExpiry(t *testing.T) {
	deadline := time.Date(2026, 9, 10, 12, 30, 0, 0, time.UTC)
	for _, tc := range []struct {
		name, status, want string
		expires            *time.Time
		now                time.Time
	}{
		{"before deadline", "approved", "approved", &deadline, deadline.Add(-time.Nanosecond)},
		{"at deadline", "approved", "expired", &deadline, deadline},
		{"after deadline", "approved", "expired", &deadline, deadline.Add(time.Second)},
		{"missing deadline", "approved", "expired", nil, deadline},
		{"used stays used", "used", "used", &deadline, deadline.Add(time.Hour)},
		{"rejected stays rejected", "rejected", "rejected", &deadline, deadline.Add(time.Hour)},
		{"pending has no approval deadline", "pending", "pending", nil, deadline},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := employeeResetStatus(models.EmployeePasswordResetRequest{Status: tc.status, ExpiresAt: tc.expires}, tc.now); got != tc.want {
				t.Fatalf("status = %s, want %s", got, tc.want)
			}
		})
	}
}

func TestEmployeePasswordResetPublicView(t *testing.T) {
	for _, state := range []string{"pending", "approved", "rejected", "used", "expired"} {
		deadline := time.Now().UTC().Add(time.Hour)
		request := models.EmployeePasswordResetRequest{
			Status: state, UserID: "private-user", BrowserTokenHash: "private-hash", RejectionReason: "Callback failed", ExpiresAt: &deadline,
		}
		view := employeeResetPublicView(request, time.Now().UTC())
		if view["status"] != state {
			t.Fatalf("unexpected status: %v", view)
		}
		if state == "rejected" {
			if len(view) != 2 || view["rejection_reason"] != "Callback failed" {
				t.Fatalf("rejected view must include its reason: %v", view)
			}
		} else if len(view) != 1 {
			t.Fatalf("non-rejected view exposed extra fields: %v", view)
		}
	}
}

// These checks catch missing authentication and accepting URL/body tokens in place
// of the browser-bound header without requiring PostgreSQL.
func TestEmployeePasswordResetRoutesRejectMissingCredentials(t *testing.T) {
	app := fiber.New()
	RegisterEmployeeAuthRoutes(app, nil)
	for _, route := range []struct{ method, path string }{
		{http.MethodGet, resetAdminPath}, {http.MethodGet, resetAdminPath + "/count"},
		{http.MethodPatch, resetAdminPath + "/request-id"},
	} {
		resetTestRequest(t, app, route.method, route.path, nil, "", nil, 401).Body.Close()
	}
	resetTestRequest(t, app, "GET", resetPublicPath+"/status?token="+strings.Repeat("a", 64), nil, "", nil, 400).Body.Close()
	resetTestRequest(t, app, "POST", resetPublicPath+"/complete", map[string]string{
		"token": strings.Repeat("a", 64), "new_password": "NewPass123!", "confirm_password": "NewPass123!",
	}, "", nil, 400).Body.Close()
	resetTestRequest(t, app, "POST", resetPublicPath+"/requests", map[string]string{"identifier": " "}, "", nil, 400).Body.Close()
	resetTestRequest(t, app, "GET", resetPublicPath+"/status", nil, "invalid", nil, 400).Body.Close()
}

func TestEmployeePasswordResetFlow(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_USER", models.PersonnelTypeInternal, "reset@example.test", "0811111111", "OldPass123!")
	admin := employeeAccountTestUser(t, db, "RESET_ADMIN", models.PersonnelTypeInternal, "resetadmin@example.test", "0822222222", "AdminPass123!")
	if err := db.Model(&admin).Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}
	userCookie := startEmployeeAccountTestSession(t, app, user.UserID)
	startEmployeeAccountTestSession(t, app, user.UserID)
	adminCookie := startEmployeeAccountTestSession(t, app, admin.UserID)
	request := createResetTestRequest(t, app, " RESET@EXAMPLE.TEST ")
	other := createResetTestRequest(t, app, user.Email)
	var stored models.EmployeePasswordResetRequest
	if err := db.First(&stored, "reference_code = ?", request.ReferenceCode).Error; err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(request.BrowserToken))
	if len(request.BrowserToken) != 64 || stored.BrowserTokenHash != hex.EncodeToString(sum[:]) || stored.BrowserTokenHash == request.BrowserToken {
		t.Fatal("browser token must contain 32 random bytes and only its SHA-256 hex may be stored")
	}
	assertResetStatus(t, app, request.BrowserToken, "pending")
	decision := map[string]any{"decision": "approve", "phone_verified": true}
	resetTestRequest(t, app, "PATCH", resetAdminPath+"/"+stored.RequestID, decision, "", userCookie, 403).Body.Close()
	resetTestRequest(t, app, "GET", resetAdminPath, nil, "", userCookie, 403).Body.Close()
	resetTestRequest(t, app, "GET", resetAdminPath+"/count", nil, "", userCookie, 403).Body.Close()
	resetTestRequest(t, app, "PATCH", resetAdminPath+"/"+stored.RequestID, map[string]any{"decision": "approve"}, "", adminCookie, 400).Body.Close()
	resetTestRequest(t, app, "PATCH", resetAdminPath+"/"+stored.RequestID, decision, "", adminCookie, 200).Body.Close()
	if err := db.First(&stored, "request_id = ?", stored.RequestID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Status != "approved" || stored.ApprovedBy == nil || *stored.ApprovedBy != admin.UserID || stored.PhoneVerifiedAt == nil || stored.ApprovedAt == nil || stored.ExpiresAt == nil || stored.ExpiresAt.Sub(*stored.ApprovedAt) != 30*time.Minute {
		t.Fatalf("approval metadata invalid: %#v", stored)
	}
	assertResetStatus(t, app, request.BrowserToken, "approved")
	resetTestRequest(t, app, "PATCH", resetAdminPath+"/"+stored.RequestID, decision, "", adminCookie, 409).Body.Close()
	list := resetTestRequest(t, app, "GET", resetAdminPath, nil, "", adminCookie, 200)
	listBody, _ := io.ReadAll(list.Body)
	list.Body.Close()
	if !bytes.Contains(listBody, []byte(user.PhoneNumber)) || bytes.Contains(listBody, []byte(request.BrowserToken)) || bytes.Contains(listBody, []byte(stored.BrowserTokenHash)) || bytes.Contains(listBody, []byte(user.PasswordHash)) {
		t.Fatal("admin list must contain callback phone but no credentials")
	}
	var count struct {
		Count int64 `json:"count"`
	}
	decodeEmployeeAccountTestBody(t, resetTestRequest(t, app, "GET", resetAdminPath+"/count", nil, "", adminCookie, 200), &count)
	if count.Count != 1 {
		t.Fatalf("pending count = %d, want 1", count.Count)
	}
	for _, payload := range []map[string]string{
		{"new_password": "short", "confirm_password": "short"},
		{"new_password": "NewSecure123!", "confirm_password": "Mismatch123!"},
	} {
		resetTestRequest(t, app, "POST", resetPublicPath+"/complete", payload, request.BrowserToken, nil, 400).Body.Close()
	}
	payload := map[string]string{"new_password": "NewSecure123!", "confirm_password": "NewSecure123!"}
	resetTestRequest(t, app, "POST", resetPublicPath+"/complete", payload, request.BrowserToken, nil, 204).Body.Close()
	resetTestRequest(t, app, "POST", resetPublicPath+"/complete", payload, request.BrowserToken, nil, 400).Body.Close()
	assertResetStatus(t, app, request.BrowserToken, "used")
	assertResetStatus(t, app, other.BrowserToken, "expired")
	if err := db.First(&user, "user_id = ?", user.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("NewSecure123!")) != nil {
		t.Fatal("new password not saved")
	}
	if err := db.First(&stored, "request_id = ?", stored.RequestID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.UsedAt == nil {
		t.Fatal("used_at not saved")
	}
	var sessions int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Count(&sessions).Error; err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatalf("%d sessions survived reset", sessions)
	}
	var audit []models.EmpActivityLogs
	if err := db.Where("user_id = ? AND action_type = ?", user.UserID, "รีเซ็ตรหัสผ่าน").Find(&audit).Error; err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(audit)
	if len(audit) != 1 || bytes.Contains(encoded, []byte(request.BrowserToken)) || bytes.Contains(encoded, []byte("NewSecure123!")) || bytes.Contains(encoded, []byte(user.PasswordHash)) {
		t.Fatal("reset audit missing, duplicated, or contains a secret")
	}
}

func TestEmployeePasswordResetRejectsWrongOrExpiredToken(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_INVALID", models.PersonnelTypeInternal, "invalidreset@example.test", "0833333333", "OldPass123!")
	for _, state := range []string{"pending", "rejected", "used", "expired", "deadline", "no_expiry"} {
		t.Run(state, func(t *testing.T) {
			request := createResetTestRequest(t, app, user.Email)
			status := state
			expiry := time.Now().UTC().Add(-time.Minute)
			updates := map[string]any{"status": status}
			if state == "deadline" {
				status = "expired"
				updates["status"] = "approved"
				updates["expires_at"] = expiry
			}
			if state == "no_expiry" {
				status = "expired"
				updates["status"] = "approved"
			}
			if err := db.Model(&models.EmployeePasswordResetRequest{}).Where("reference_code = ?", request.ReferenceCode).Updates(updates).Error; err != nil {
				t.Fatal(err)
			}
			resetTestRequest(t, app, "POST", resetPublicPath+"/complete", map[string]string{"new_password": "NewSecure123!", "confirm_password": "NewSecure123!"}, request.BrowserToken, nil, 400).Body.Close()
			assertResetStatus(t, app, request.BrowserToken, status)
		})
	}
	resetTestRequest(t, app, "POST", resetPublicPath+"/complete", map[string]string{"new_password": "NewSecure123!", "confirm_password": "NewSecure123!"}, strings.Repeat("f", 64), nil, 400).Body.Close()
	var stored models.User
	if err := db.First(&stored, "user_id = ?", user.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.PasswordHash != user.PasswordHash {
		t.Fatal("invalid reset changed password")
	}
}

func TestEmployeePasswordResetDoesNotEnumerateAccounts(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_KNOWN", models.PersonnelTypeInternal, "knownreset@example.test", "0844444444", "OldPass123!")
	for _, identifier := range []string{user.Email, "missing@example.test"} {
		request := createResetTestRequest(t, app, identifier)
		assertResetStatus(t, app, request.BrowserToken, "pending")
	}
	if err := db.Model(&user).Update("employee_inactive", true).Error; err != nil {
		t.Fatal(err)
	}
	createResetTestRequest(t, app, user.Email)
	var count int64
	if err := db.Model(&models.EmployeePasswordResetRequest{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("unknown/inactive identifiers created rows; count=%d", count)
	}
}

func TestEmployeePasswordResetAdminRejection(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_REJECTION", models.PersonnelTypeInternal, "rejectreset@example.test", "0855555555", "OldPass123!")
	if err := db.Model(&user).Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}
	cookie := startEmployeeAccountTestSession(t, app, user.UserID)
	request := createResetTestRequest(t, app, user.Email)
	var stored models.EmployeePasswordResetRequest
	if err := db.First(&stored, "reference_code = ?", request.ReferenceCode).Error; err != nil {
		t.Fatal(err)
	}
	path := resetAdminPath + "/" + stored.RequestID
	resetTestRequest(t, app, "PATCH", path, map[string]string{"decision": "reject", "reason": " "}, "", cookie, 400).Body.Close()
	resetTestRequest(t, app, "PATCH", path, map[string]string{"decision": "approve_anyway"}, "", cookie, 400).Body.Close()
	resetTestRequest(t, app, "PATCH", path, map[string]string{"decision": "reject", "reason": " Callback failed "}, "", cookie, 200).Body.Close()
	assertResetStatus(t, app, request.BrowserToken, "rejected")
	var rejected map[string]string
	decodeEmployeeAccountTestBody(t, resetTestRequest(t, app, "GET", resetPublicPath+"/status", nil, request.BrowserToken, nil, 200), &rejected)
	if rejected["rejection_reason"] != "Callback failed" {
		t.Fatalf("owner did not receive rejection reason: %v", rejected)
	}
	assertResetStatus(t, app, strings.Repeat("e", 64), "pending")
	unrelated := createResetTestRequest(t, app, user.Email)
	assertResetStatus(t, app, unrelated.BrowserToken, "pending")
	if err := db.First(&stored, "request_id = ?", stored.RequestID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.RejectionReason != "Callback failed" || stored.ApprovedAt != nil || stored.PhoneVerifiedAt != nil {
		t.Fatal("rejection metadata invalid")
	}
	resetTestRequest(t, app, "PATCH", path, map[string]any{"decision": "approve", "phone_verified": true}, "", cookie, 409).Body.Close()
}

func TestEmployeePasswordResetConcurrentCompletion(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_CONCURRENT", models.PersonnelTypeInternal, "concurrentreset@example.test", "0866666666", "OldPass123!")
	first := createResetTestRequest(t, app, user.Email)
	second := createResetTestRequest(t, app, user.Email)
	now := time.Now().UTC()
	if err := db.Model(&models.EmployeePasswordResetRequest{}).Where("user_id = ?", user.UserID).Updates(map[string]any{
		"status": "approved", "approved_at": now, "phone_verified_at": now, "approved_by": user.UserID, "expires_at": now.Add(30 * time.Minute),
	}).Error; err != nil {
		t.Fatal(err)
	}
	var wait sync.WaitGroup
	start := make(chan struct{})
	statuses := make(chan int, 2)
	requestErrors := make(chan error, 2)
	for _, token := range []string{first.BrowserToken, second.BrowserToken} {
		wait.Add(1)
		go func(token string) {
			defer wait.Done()
			<-start
			req := httptest.NewRequest("POST", resetPublicPath+"/complete", strings.NewReader(`{"new_password":"NewSecure123!","confirm_password":"NewSecure123!"}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Employee-Reset-Token", token)
			resp, err := app.Test(req, 10000)
			if err != nil {
				requestErrors <- err
				return
			}
			resp.Body.Close()
			statuses <- resp.StatusCode
		}(token)
	}
	close(start)
	wait.Wait()
	close(statuses)
	close(requestErrors)
	for err := range requestErrors {
		t.Error(err)
	}
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	if counts[204] != 1 || counts[400] != 1 {
		t.Fatalf("competing completions returned %v, want one success and one rejection", counts)
	}
	var audits int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, "รีเซ็ตรหัสผ่าน").Count(&audits).Error; err != nil {
		t.Fatal(err)
	}
	if audits != 1 {
		t.Fatalf("competing completions created %d audits, want 1", audits)
	}
}

func TestEmployeePasswordResetRollsBackWhenAuditFails(t *testing.T) {
	db := resetTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "RESET_ROLLBACK", models.PersonnelTypeInternal, "rollbackreset@example.test", "0877777777", "OldPass123!")
	startEmployeeAccountTestSession(t, app, user.UserID)
	request := createResetTestRequest(t, app, user.Email)
	other := createResetTestRequest(t, app, user.Email)
	now := time.Now().UTC()
	if err := db.Model(&models.EmployeePasswordResetRequest{}).Where("reference_code = ?", request.ReferenceCode).Updates(map[string]any{
		"status": "approved", "approved_at": now, "phone_verified_at": now, "approved_by": user.UserID, "expires_at": now.Add(30 * time.Minute),
	}).Error; err != nil {
		t.Fatal(err)
	}
	// Fail the final write in this isolated test schema after password/session updates.
	if err := db.Exec("ALTER TABLE emp_activity_logs ADD CONSTRAINT reset_test_reject_audit CHECK (action_type <> 'รีเซ็ตรหัสผ่าน')").Error; err != nil {
		t.Fatal(err)
	}
	resetTestRequest(t, app, "POST", resetPublicPath+"/complete", map[string]string{"new_password": "NewSecure123!", "confirm_password": "NewSecure123!"}, request.BrowserToken, nil, 500).Body.Close()
	var stored models.User
	if err := db.First(&stored, "user_id = ?", user.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.PasswordHash != user.PasswordHash {
		t.Fatal("audit failure committed password")
	}
	assertResetStatus(t, app, request.BrowserToken, "approved")
	assertResetStatus(t, app, other.BrowserToken, "pending")
	var sessions int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Count(&sessions).Error; err != nil {
		t.Fatal(err)
	}
	if sessions != 1 {
		t.Fatal("audit failure committed session deletion")
	}
}

type resetTestReceipt struct {
	ReferenceCode string `json:"reference_code"`
	BrowserToken  string `json:"browser_token"`
	Message       string `json:"message"`
}

func resetTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := managementTestDB(t)
	if err := db.AutoMigrate(&models.EmployeePasswordResetRequest{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func createResetTestRequest(t *testing.T, app *fiber.App, identifier string) resetTestReceipt {
	t.Helper()
	response := resetTestRequest(t, app, "POST", resetPublicPath+"/requests", map[string]string{"identifier": identifier}, "", nil, 202)
	var body map[string]string
	decodeEmployeeAccountTestBody(t, response, &body)
	if len(body) != 3 || body["reference_code"] == "" || body["browser_token"] == "" || body["message"] == "" {
		t.Fatalf("unexpected public response shape: %v", body)
	}
	return resetTestReceipt{ReferenceCode: body["reference_code"], BrowserToken: body["browser_token"], Message: body["message"]}
}

func assertResetStatus(t *testing.T, app *fiber.App, token, want string) {
	t.Helper()
	var body map[string]string
	decodeEmployeeAccountTestBody(t, resetTestRequest(t, app, "GET", resetPublicPath+"/status", nil, token, nil, 200), &body)
	expectedFields := 1
	if want == "rejected" {
		expectedFields = 2
	}
	if len(body) != expectedFields || body["status"] != want {
		t.Fatalf("status response = %v, want only status=%s", body, want)
	}
}

func resetTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, token string, cookie *http.Cookie, want int) *http.Response {
	t.Helper()
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}
	req := httptest.NewRequest(method, path, body)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("X-Employee-Reset-Token", token)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	response, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != want {
		content, _ := io.ReadAll(response.Body)
		response.Body.Close()
		t.Fatalf("%s %s returned %d, want %d: %s", method, path, response.StatusCode, want, content)
	}
	return response
}
