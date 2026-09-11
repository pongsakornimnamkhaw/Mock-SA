package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func passwordSetupRequest(t *testing.T, app interface {
	Test(*http.Request, ...int) (*http.Response, error)
}, token, body string, wantStatus int) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/employee/auth/setup-password", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-Employee-Setup-Token", token)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != wantStatus {
		defer resp.Body.Close()
		t.Fatalf("setup returned %d, want %d", resp.StatusCode, wantStatus)
	}
	return resp
}

func TestEmployeePasswordSetupConsumesTokenAndChangesPassword(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_SETUP_COMPLETE", models.PersonnelTypeInternal, "complete@example.test", "0812345678", "0812345678")
	if err := db.Model(&user).Update("must_change_password", true).Error; err != nil {
		t.Fatal(err)
	}
	raw, err := createEmployeePasswordSetupToken(db, user.UserID, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	passwordSetupRequest(t, app, raw, `{"new_password":"NewSecure123!","confirm_password":"NewSecure123!"}`, http.StatusNoContent).Body.Close()

	var stored models.User
	if err := db.First(&stored, "user_id = ?", user.UserID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.MustChangePassword {
		t.Fatal("setup flag was not cleared")
	}
	if bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("NewSecure123!")) != nil {
		t.Fatal("new password was not stored")
	}
	passwordSetupRequest(t, app, raw, `{"new_password":"AnotherSecure123!","confirm_password":"AnotherSecure123!"}`, http.StatusBadRequest).Body.Close()
}

func TestEmployeePasswordSetupRejectsExpiredAndInvalidRequests(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_SETUP_INVALID", models.PersonnelTypeInternal, "invalid@example.test", "0898765432", "0898765432")
	if err := db.Model(&user).Update("must_change_password", true).Error; err != nil {
		t.Fatal(err)
	}
	raw, err := createEmployeePasswordSetupToken(db, user.UserID, time.Now().UTC().Add(-employeePasswordSetupTTL-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	passwordSetupRequest(t, app, raw, `{"new_password":"NewSecure123!","confirm_password":"NewSecure123!"}`, http.StatusBadRequest).Body.Close()
	passwordSetupRequest(t, app, "bad-token", `{"new_password":"NewSecure123!","confirm_password":"NewSecure123!"}`, http.StatusBadRequest).Body.Close()
	passwordSetupRequest(t, app, strings.Repeat("a", 64), `{"new_password":"short","confirm_password":"different"}`, http.StatusBadRequest).Body.Close()
}
