package handlers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestEmployeeAccountRoutesRequireSession(t *testing.T) {
	app := fiber.New()
	RegisterEmployeeAuthRoutes(app, nil)
	for _, route := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/employee/account"},
		{http.MethodPatch, "/api/employee/account/profile"},
		{http.MethodPatch, "/api/employee/account/password"},
		{http.MethodGet, "/api/employee/account/activity"},
	} {
		response := employeeAccountTestRequest(t, app, route.method, route.path, nil, nil, http.StatusUnauthorized)
		response.Body.Close()
	}
}

func TestEmployeeAccountProfileRules(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)

	internal := employeeAccountTestUser(t, db, "EMPLOYEE_ACCOUNT_INTERNAL", models.PersonnelTypeInternal, "internal@example.test", "0811111111", "InternalPass123!")
	external := employeeAccountTestUser(t, db, "EMPLOYEE_ACCOUNT_EXTERNAL", models.PersonnelTypeExternal, "external@example.test", "0822222222", "ExternalPass123!")
	internalCookie := startEmployeeAccountTestSession(t, app, internal.UserID)
	externalCookie := startEmployeeAccountTestSession(t, app, external.UserID)

	detailResponse := employeeAccountTestRequest(t, app, http.MethodGet, "/api/employee/account", nil, internalCookie, http.StatusOK)
	var detail struct {
		Data struct {
			Email         string `json:"email"`
			Phone         string `json:"phone"`
			PersonnelType string `json:"personnel_type"`
			Active        bool   `json:"active"`
		} `json:"data"`
	}
	decodeEmployeeAccountTestBody(t, detailResponse, &detail)
	if detail.Data.PersonnelType != models.PersonnelTypeInternal || !detail.Data.Active {
		t.Fatalf("unexpected internal account detail: %#v", detail.Data)
	}

	forbiddenResponse := employeeAccountTestRequest(t, app, http.MethodPatch, "/api/employee/account/profile", map[string]string{
		"email": "changed-internal@example.test", "phone": "0899999999",
	}, internalCookie, http.StatusForbidden)
	forbiddenResponse.Body.Close()
	var storedInternal models.User
	if err := db.First(&storedInternal, "user_id = ?", internal.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if storedInternal.Email != internal.Email || storedInternal.PhoneNumber != internal.PhoneNumber {
		t.Fatalf("forbidden internal profile change was persisted: %#v", storedInternal)
	}

	phoneResponse := employeeAccountTestRequest(t, app, http.MethodPatch, "/api/employee/account/profile", map[string]string{
		"email": internal.Email, "phone": "0833333333",
	}, internalCookie, http.StatusOK)
	decodeEmployeeAccountTestBody(t, phoneResponse, &detail)
	if detail.Data.Email != internal.Email || detail.Data.Phone != "0833333333" {
		t.Fatalf("internal phone update returned unexpected profile: %#v", detail.Data)
	}
	if err := db.First(&storedInternal, "user_id = ?", internal.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if storedInternal.Email != internal.Email || storedInternal.PhoneNumber != "0833333333" {
		t.Fatalf("internal phone update was not persisted: %#v", storedInternal)
	}

	externalResponse := employeeAccountTestRequest(t, app, http.MethodPatch, "/api/employee/account/profile", map[string]string{
		"email": " Changed-External@Example.Test ", "phone": "+66 84 444 4444",
	}, externalCookie, http.StatusOK)
	decodeEmployeeAccountTestBody(t, externalResponse, &detail)
	if detail.Data.Email != "changed-external@example.test" || detail.Data.Phone != "+66 84 444 4444" {
		t.Fatalf("external profile update returned unexpected profile: %#v", detail.Data)
	}
	var storedExternal models.User
	if err := db.First(&storedExternal, "user_id = ?", external.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if storedExternal.Email != "changed-external@example.test" || storedExternal.PhoneNumber != "+66 84 444 4444" {
		t.Fatalf("external profile update was not persisted: %#v", storedExternal)
	}
}

func TestEmployeeAccountPasswordAndActivityAreSessionScoped(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "EMPLOYEE_ACCOUNT_PASSWORD", models.PersonnelTypeInternal, "password@example.test", "0855555555", "CurrentPass123!")
	other := employeeAccountTestUser(t, db, "EMPLOYEE_ACCOUNT_OTHER", models.PersonnelTypeInternal, "other@example.test", "0866666666", "OtherPass123!")
	currentCookie := startEmployeeAccountTestSession(t, app, user.UserID)
	otherSessionCookie := startEmployeeAccountTestSession(t, app, user.UserID)

	now := time.Now().In(accountHistoryLocation)
	userID := user.UserID
	otherID := other.UserID
	logs := []models.EmpActivityLogs{
		{EmpLogID: "EL_EMPLOYEE_ACCOUNT_LOGIN", UserID: &userID, ActionType: "เข้าสู่ระบบ", Description: "เข้าสู่ระบบ", Module: "บัญชี", TargetID: user.UserID, CreatedAt: now.Add(-2 * time.Hour)},
		{EmpLogID: "EL_EMPLOYEE_ACCOUNT_OWN", UserID: &userID, ActionType: "แก้ไข", Description: "แก้ไขรายการของตนเอง", Module: "คอนเสิร์ต", TargetID: "CONCERT_OWN", CreatedAt: now.Add(-time.Hour)},
		{EmpLogID: "EL_EMPLOYEE_ACCOUNT_OTHER", UserID: &otherID, ActionType: "ลบ", Description: "รายการของพนักงานอื่น", Module: "คอนเสิร์ต", TargetID: "CONCERT_OTHER", CreatedAt: now},
	}
	if err := db.Create(&logs).Error; err != nil {
		t.Fatal(err)
	}

	wrongResponse := employeeAccountTestRequest(t, app, http.MethodPatch, "/api/employee/account/password", map[string]string{
		"current_password": "WrongPass123!", "new_password": "NewSecurePass456!", "confirm_password": "NewSecurePass456!",
	}, currentCookie, http.StatusBadRequest)
	wrongResponse.Body.Close()
	var passwordAuditCount int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, "เปลี่ยนรหัสผ่าน").Count(&passwordAuditCount).Error; err != nil {
		t.Fatal(err)
	}
	if passwordAuditCount != 0 {
		t.Fatalf("wrong password created %d password audit rows", passwordAuditCount)
	}

	changedResponse := employeeAccountTestRequest(t, app, http.MethodPatch, "/api/employee/account/password", map[string]string{
		"current_password": "CurrentPass123!", "new_password": "NewSecurePass456!", "confirm_password": "NewSecurePass456!",
	}, currentCookie, http.StatusNoContent)
	changedResponse.Body.Close()
	var stored models.User
	if err := db.First(&stored, "user_id = ?", user.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("NewSecurePass456!")) != nil {
		t.Fatal("new password was not stored as a bcrypt hash")
	}
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, "เปลี่ยนรหัสผ่าน").Count(&passwordAuditCount).Error; err != nil {
		t.Fatal(err)
	}
	if passwordAuditCount != 1 {
		t.Fatalf("password change created %d audit rows, expected 1", passwordAuditCount)
	}
	var sessionCount int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Count(&sessionCount).Error; err != nil {
		t.Fatal(err)
	}
	if sessionCount != 1 {
		t.Fatalf("password change retained %d sessions, expected only the current session", sessionCount)
	}
	var currentSessionCount int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(currentCookie.Value)).Count(&currentSessionCount).Error; err != nil {
		t.Fatal(err)
	}
	if currentSessionCount != 1 {
		t.Fatal("password change removed the current session")
	}
	var otherSessionCount int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(otherSessionCookie.Value)).Count(&otherSessionCount).Error; err != nil {
		t.Fatal(err)
	}
	if otherSessionCount != 0 {
		t.Fatal("password change did not remove another session")
	}

	activityResponse := employeeAccountTestRequest(t, app, http.MethodGet, "/api/employee/account/activity?page=1&page_size=100", nil, currentCookie, http.StatusOK)
	var activity struct {
		Data     []models.EmpActivityLogs `json:"data"`
		Page     int                      `json:"page"`
		PageSize int                      `json:"page_size"`
		Total    int64                    `json:"total"`
	}
	decodeEmployeeAccountTestBody(t, activityResponse, &activity)
	if activity.Page != 1 || activity.PageSize != 50 || activity.Total != 3 || len(activity.Data) != 3 {
		t.Fatalf("unexpected activity pagination: %#v", activity)
	}
	for _, row := range activity.Data {
		if row.UserID == nil || *row.UserID != user.UserID {
			t.Fatalf("another employee's activity leaked into response: %#v", row)
		}
		if row.ActionType == employeeSessionAction {
			t.Fatalf("private employee session leaked into activity response: %#v", row)
		}
	}

	filteredResponse := employeeAccountTestRequest(t, app, http.MethodGet, "/api/employee/account/activity?module=บัญชี&action=เปลี่ยนรหัสผ่าน", nil, currentCookie, http.StatusOK)
	decodeEmployeeAccountTestBody(t, filteredResponse, &activity)
	if activity.Total != 1 || len(activity.Data) != 1 || activity.Data[0].ActionType != "เปลี่ยนรหัสผ่าน" {
		t.Fatalf("activity filters returned unexpected rows: %#v", activity)
	}
}

func newEmployeeAccountTestApp(db *gorm.DB) *fiber.App {
	app := fiber.New()
	RegisterEmployeeAuthRoutes(app, db)
	h := &employeeAuthHandler{db: db}
	app.Post("/__test/employee-session/:userID", func(c *fiber.Ctx) error {
		return h.startSession(c, c.Params("userID"))
	})
	return app
}

func employeeAccountTestUser(t *testing.T, db *gorm.DB, userID, personnelType, email, phone, password string) models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	code := strings.TrimPrefix(userID, "EMPLOYEE_ACCOUNT_")
	user := models.User{
		UserID: userID, FirstName: "พนักงาน", LastName: code, DateOfBirth: time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC),
		Gender: "ไม่ระบุ", PhoneNumber: phone, Email: email, PasswordHash: string(hash), UserType: "employee",
		Role: "view_only", EmployeeCode: &code, Department: "ทดสอบ", PersonnelType: personnelType,
	}
	if err := db.Omit(clause.Associations).Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	return user
}

func startEmployeeAccountTestSession(t *testing.T, app *fiber.App, userID string) *http.Cookie {
	t.Helper()
	response := employeeAccountTestRequest(t, app, http.MethodPost, "/__test/employee-session/"+userID, nil, nil, http.StatusOK)
	defer response.Body.Close()
	for _, cookie := range response.Cookies() {
		if cookie.Name == employeeSessionCookie {
			return cookie
		}
	}
	t.Fatal("startSession did not return an employee session cookie")
	return nil
}

func employeeAccountTestRequest(t *testing.T, app *fiber.App, method, path string, payload any, cookie *http.Cookie, expectedStatus int) *http.Response {
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

func decodeEmployeeAccountTestBody(t *testing.T, response *http.Response, target any) {
	t.Helper()
	defer response.Body.Close()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}
