package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestEmployeeAuthRequiresPasswordSetupWithoutSession(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_SETUP", models.PersonnelTypeInternal, "setup@example.test", "0812345678", "0812345678")
	if err := db.Model(&user).Update("must_change_password", true).Error; err != nil {
		t.Fatal(err)
	}
	response := employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": user.Email, "password": user.PhoneNumber}, nil, 200)
	defer response.Body.Close()
	var body struct {
		Requires bool   `json:"requires_password_setup"`
		Token    string `json:"setup_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if !body.Requires || len(body.Token) != 64 {
		t.Fatalf("unexpected setup response: %+v", body)
	}
	if len(response.Cookies()) != 0 {
		t.Fatal("first-login setup must not create an employee session")
	}
}

func TestEmployeeAuthRejectsInactiveEmployee(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_INACTIVE", models.PersonnelTypeInternal, "inactive@example.test", "0811111122", "AccountPassword123!")
	if err := db.Model(&user).Update("employee_inactive", true).Error; err != nil {
		t.Fatal(err)
	}
	employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": user.Email, "password": "AccountPassword123!"}, nil, http.StatusUnauthorized).Body.Close()
}

func TestEmployeePasswordSetupTokenHashIsNotRawToken(t *testing.T) {
	raw := strings.Repeat("a", 64)
	hash, err := employeePasswordSetupTokenHash(raw)
	if err != nil {
		t.Fatal(err)
	}
	if hash == raw || len(hash) != 64 {
		t.Fatalf("unsafe token hash %q", hash)
	}
}

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

func TestEmployeeAuthRejectsSyntheticAliasWithoutPersistedAccount(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	response := employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{
		"username": "missing-sales-alias",
		"password": "AnyPassword123!",
	}, nil, 401)
	response.Body.Close()

	var logs int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ?", "EMP-B6728786").Count(&logs).Error; err != nil {
		t.Fatal(err)
	}
	if logs != 0 {
		t.Fatal("rejected synthetic alias left orphan employee activity rows")
	}
}

func TestEmployeeSessionInsertFailureDoesNotIssueCookie(t *testing.T) {
	// PostgreSQL is the external dependency here. DryRun keeps real GORM create
	// callbacks while injecting one storage error, without a database connection.
	db, err := gorm.Open(postgres.New(postgres.Config{DSN: "host=localhost user=test dbname=test sslmode=disable"}), &gorm.Config{
		DryRun: true, DisableAutomaticPing: true, SkipDefaultTransaction: true, Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	wantErr := errors.New("session insert failed")
	if err := db.Callback().Create().Before("gorm:create").Register("test:session_insert_error", func(tx *gorm.DB) { tx.AddError(wantErr) }); err != nil {
		t.Fatal(err)
	}
	h := &employeeAuthHandler{db: db}
	app := fiber.New()
	var gotErr error
	app.Post("/session", func(c *fiber.Ctx) error { gotErr = h.startSession(c, "TEST_EMPLOYEE"); return gotErr })
	response, err := app.Test(httptest.NewRequest("POST", "/session", nil))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if !errors.Is(gotErr, wantErr) {
		t.Fatalf("startSession error=%v, want storage error", gotErr)
	}
	if response.StatusCode != 500 || len(response.Cookies()) != 0 {
		t.Fatalf("failed insert issued session: status=%d cookies=%d", response.StatusCode, len(response.Cookies()))
	}
}

func TestEmployeeAuthSessionInsertFailureRollsBackLogin(t *testing.T) {
	db := managementTestDB(t)
	app := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_INSERT_FAILURE", models.PersonnelTypeInternal, "insertfailure@example.test", "0811111111", "AccountPassword123!")
	if err := db.Exec("ALTER TABLE emp_activity_logs ADD CONSTRAINT auth_test_reject_session CHECK (action_type <> 'EMPLOYEE_AUTH_SESSION')").Error; err != nil {
		t.Fatal(err)
	}
	response := employeeAccountTestRequest(t, app, "POST", "/api/employee/auth/login", map[string]string{"username": user.Email, "password": "AccountPassword123!"}, nil, 500)
	defer response.Body.Close()
	if len(response.Cookies()) != 0 {
		t.Fatal("failed session insert issued a cookie")
	}
	var logs int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ?", user.UserID).Count(&logs).Error; err != nil {
		t.Fatal(err)
	}
	if logs != 0 {
		t.Fatal("failed session insert created login activity")
	}
}

func TestEmployeeAuthConcurrentOldPasswordLoginCannotSurviveReset(t *testing.T) {
	db := resetTestDB(t)
	setupApp := newEmployeeAccountTestApp(db)
	user := employeeAccountTestUser(t, db, "AUTH_RESET_RACE", models.PersonnelTypeInternal, "resetrace@example.test", "0822222222", "OldPassword123!")
	receipt := createResetTestRequest(t, setupApp, user.Email)
	now := time.Now().UTC()
	if err := db.Model(&models.EmployeePasswordResetRequest{}).Where("reference_code = ?", receipt.ReferenceCode).Updates(map[string]any{
		"status": "approved", "approved_at": now, "phone_verified_at": now, "approved_by": user.UserID, "expires_at": now.Add(30 * time.Minute),
	}).Error; err != nil {
		t.Fatal(err)
	}
	// Separate GORM handles provide independent callbacks over the same isolated
	// PostgreSQL schema/pool. No timing assumption or mock replaces database locks.
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	loginDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	resetDB, err := gorm.Open(postgres.New(postgres.Config{Conn: sqlDB}), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	loginAtInsert := make(chan int, 1)
	resetAtUser := make(chan int, 1)
	resumeLogin := make(chan struct{})
	var releaseOnce, resetQueryOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(resumeLogin) }) }
	var workers sync.WaitGroup
	defer func() { release(); workers.Wait() }()
	if err := loginDB.Callback().Create().Before("gorm:create").Register("test:pause_session_insert", func(tx *gorm.DB) {
		row, ok := tx.Statement.Dest.(*models.EmpActivityLogs)
		if !ok || row.ActionType != employeeSessionAction {
			return
		}
		var pid int
		if err := tx.Statement.ConnPool.QueryRowContext(context.Background(), "SELECT pg_backend_pid()").Scan(&pid); err != nil {
			tx.AddError(err)
		}
		loginAtInsert <- pid
		<-resumeLogin
	}); err != nil {
		t.Fatal(err)
	}
	if err := resetDB.Callback().Query().Before("gorm:query").Register("test:observe_user_lock", func(tx *gorm.DB) {
		if tx.Statement.Schema == nil || tx.Statement.Schema.Name != "User" {
			return
		}
		resetQueryOnce.Do(func() {
			var pid int
			if err := tx.Statement.ConnPool.QueryRowContext(context.Background(), "SELECT pg_backend_pid()").Scan(&pid); err != nil {
				tx.AddError(err)
			}
			resetAtUser <- pid
		})
	}); err != nil {
		t.Fatal(err)
	}
	loginApp, resetApp := fiber.New(), fiber.New()
	RegisterEmployeeAuthRoutes(loginApp, loginDB)
	RegisterEmployeeAuthRoutes(resetApp, resetDB)
	type result struct {
		response *http.Response
		err      error
	}
	launch := func(app *fiber.App, request *http.Request) <-chan result {
		results := make(chan result, 1)
		workers.Add(1)
		go func() {
			defer workers.Done()
			response, err := app.Test(request, 15000)
			results <- result{response, err}
		}()
		return results
	}
	loginRequest := httptest.NewRequest("POST", "/api/employee/auth/login", strings.NewReader(`{"username":"resetrace@example.test","password":"OldPassword123!"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginDone := launch(loginApp, loginRequest)
	var loginPID, resetPID int
	select {
	case loginPID = <-loginAtInsert:
	case <-time.After(5 * time.Second):
		t.Fatal("login did not reach session insert")
	}
	if loginPID == 0 {
		t.Fatal("could not identify login PostgreSQL connection")
	}
	resetRequest := httptest.NewRequest("POST", resetPublicPath+"/complete", strings.NewReader(`{"new_password":"NewPassword123!","confirm_password":"NewPassword123!"}`))
	resetRequest.Header.Set("Content-Type", "application/json")
	resetRequest.Header.Set("X-Employee-Reset-Token", receipt.BrowserToken)
	resetDone := launch(resetApp, resetRequest)
	select {
	case resetPID = <-resetAtUser:
	case <-time.After(5 * time.Second):
		t.Fatal("reset did not reach employee lock")
	}
	if resetPID == 0 {
		t.Fatal("could not identify reset PostgreSQL connection")
	}
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(10 * time.Millisecond)
	defer tick.Stop()
	waiting := true
	for waiting {
		select {
		case premature := <-resetDone:
			if premature.response != nil {
				premature.response.Body.Close()
			}
			t.Fatal("reset completed before the old-password login inserted its session; login did not retain the user lock")
		case <-deadline.C:
			t.Fatal("reset never waited on the login user lock")
		case <-tick.C:
			var blocked bool
			if err := db.Raw("SELECT ? = ANY(pg_blocking_pids(?))", loginPID, resetPID).Scan(&blocked).Error; err != nil {
				t.Fatal(err)
			}
			waiting = !blocked
		}
	}
	release()
	loginResult := <-loginDone
	if loginResult.err != nil {
		t.Fatal(loginResult.err)
	}
	defer loginResult.response.Body.Close()
	if loginResult.response.StatusCode != 200 {
		t.Fatalf("login status=%d", loginResult.response.StatusCode)
	}
	resetResult := <-resetDone
	if resetResult.err != nil {
		t.Fatal(resetResult.err)
	}
	defer resetResult.response.Body.Close()
	if resetResult.response.StatusCode != 204 {
		t.Fatalf("reset status=%d", resetResult.response.StatusCode)
	}
	var cookie *http.Cookie
	for _, candidate := range loginResult.response.Cookies() {
		if candidate.Name == employeeSessionCookie {
			cookie = candidate
		}
	}
	if cookie == nil {
		t.Fatal("successful login did not issue a cookie")
	}
	employeeAccountTestRequest(t, setupApp, "GET", "/api/employee/auth/me", nil, cookie, 401).Body.Close()
	var sessions int64
	if err := db.Model(&models.EmpActivityLogs{}).Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Count(&sessions).Error; err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatal("old-password login session survived reset")
	}
}
