package handlers

import (
	"strconv"
	"testing"
	"time"

	"backend/internal/models"
	"golang.org/x/crypto/bcrypt"
)

func TestEmployeeAuthRejectsDemoPasswordBypass(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("AccountPassword123!"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	for _, password := range []string{"Admin1234!", "Demo1234!", "WrongPassword123!"} {
		if employeeLoginPasswordMatches(string(hash), password) {
			t.Errorf("database account accepted a password that does not match its bcrypt hash")
		}
	}
	if !employeeLoginPasswordMatches(string(hash), "AccountPassword123!") {
		t.Fatal("correct password rejected")
	}
	if employeeLoginPasswordMatches("", "Admin1234!") {
		t.Fatal("empty stored password hash accepted")
	}
}

func TestEmployeeAuthAllowsDemoPasswordOnlyWhenHashMatches(t *testing.T) {
	for _, password := range []string{"Admin1234!", "Demo1234!"} {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
		if err != nil {
			t.Fatal(err)
		}
		if !employeeLoginPasswordMatches(string(hash), password) {
			t.Fatal("legitimately configured password rejected")
		}
	}
}

func TestEmployeeSessionExpiryValidation(t *testing.T) {
	now := time.Unix(2_000_000_000, 0)
	for _, tc := range []struct {
		name, description string
		expired           bool
	}{
		{"missing", "", true}, {"invalid", "not-an-expiry", true}, {"overflow", "99999999999999999999999999999", true},
		{"past", "1999999999", true}, {"exact deadline", "2000000000", true}, {"future", "2000000001", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := employeeSessionExpired(tc.description, now); got != tc.expired {
				t.Fatalf("expired=%v, want %v", got, tc.expired)
			}
		})
	}
}

func TestEmployeeAuthDatabaseLoginRejectsBypass(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_REAL", models.PersonnelTypeInternal, "real-sales@example.test", "0888888888", "AccountPassword123!")
	for _, password := range []string{"Admin1234!", "Demo1234!"} {
		employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": user.Email, "password": password}, nil, 401).Body.Close()
	}
	employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": user.Email, "password": "AccountPassword123!"}, nil, 200).Body.Close()
}

func TestEmployeeSessionRejectsAndDeletesInvalidExpiry(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_EXPIRY", models.PersonnelTypeInternal, "expiry@example.test", "0899999999", "AccountPassword123!")
	for _, expiry := range []string{"", "invalid", strconv.FormatInt(time.Now().Unix()-60, 10)} {
		cookie := startEmployeeAccountTestSession(t, app, user.UserID)
		query := db.Model(&models.EmpActivityLogs{}).Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(cookie.Value))
		if err := query.Update("description", expiry).Error; err != nil {
			t.Fatal(err)
		}
		employeeAccountTestRequest(t, app, "GET", "/api/employee/auth/me", nil, cookie, 401).Body.Close()
		var count int64
		if err := query.Count(&count).Error; err != nil {
			t.Fatal(err)
		}
		if count != 0 {
			t.Fatal("invalid/expired session row survived rejection")
		}
	}
}

func TestEmployeeAuthSyntheticAliasCannotLoginAsRealUser(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	employeeAccountTestUser(t, db, "EMP-B6728786", models.PersonnelTypeInternal, "realemployee@example.test", "0812345678", "AccountPassword123!")
	employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": "missing-sales-alias", "password": "WrongPassword123!"}, nil, 401).Body.Close()
	var sessions int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("action_type = ?", employeeSessionAction).Count(&sessions).Error; err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatal("synthetic alias created a real account session")
	}
}
