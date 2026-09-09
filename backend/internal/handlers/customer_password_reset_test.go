package handlers

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// captureMailer เก็บอีเมลฉบับล่าสุดไว้ให้เทสต์ดึง token ออกมาใช้ต่อ
type captureMailer struct {
	calls   int
	to      string
	subject string
	body    string
}

func (m *captureMailer) Send(to, subject, body string) error {
	m.calls++
	m.to, m.subject, m.body = to, subject, body
	return nil
}

func TestValidateNewCustomerPasswordRequiresEightCharacters(t *testing.T) {
	if err := validateNewCustomerPassword("1234567"); err == nil {
		t.Fatal("รหัสผ่าน 7 ตัวต้องไม่ผ่าน")
	} else if err.Error() != "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" {
		t.Fatalf("ข้อความผิด: %q", err.Error())
	}
	if err := validateNewCustomerPassword("12345678"); err != nil {
		t.Fatalf("รหัสผ่าน 8 ตัวต้องผ่าน แต่ได้ %v", err)
	}
}

func TestBuildPasswordResetLink(t *testing.T) {
	want := "http://localhost:5173/reset-password?token=abc123"
	if got := buildPasswordResetLink("http://localhost:5173", "abc123"); got != want {
		t.Fatalf("ได้ %q อยากได้ %q", got, want)
	}
	if got := buildPasswordResetLink("http://localhost:5173/", "abc123"); got != want {
		t.Fatalf("ต้องตัด / ท้าย baseURL ทิ้ง แต่ได้ %q", got)
	}
}

func TestBuildPasswordResetEmailMentionsLinkAndExpiry(t *testing.T) {
	subject, body := buildPasswordResetEmail("http://localhost:5173/reset-password?token=abc123")
	if subject == "" {
		t.Fatal("หัวข้ออีเมลต้องไม่ว่าง")
	}
	if !strings.Contains(body, "http://localhost:5173/reset-password?token=abc123") {
		t.Fatalf("เนื้อความต้องมีลิงก์: %s", body)
	}
	if !strings.Contains(body, "30 นาที") {
		t.Fatalf("เนื้อความต้องบอกอายุลิงก์: %s", body)
	}
}

func TestNewPasswordResetTokenIsRandomHex(t *testing.T) {
	first, err := newPasswordResetToken()
	if err != nil {
		t.Fatal(err)
	}
	second, err := newPasswordResetToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 64 {
		t.Fatalf("token ควรเป็น hex 64 ตัว แต่ยาว %d", len(first))
	}
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(first) {
		t.Fatalf("token ต้องเป็น hex ตัวพิมพ์เล็ก: %q", first)
	}
	if first == second {
		t.Fatal("token ต้องสุ่มใหม่ทุกครั้ง")
	}
}

func TestAppBaseURLFallsBackToViteDevServer(t *testing.T) {
	t.Setenv("APP_BASE_URL", "")
	if got := appBaseURL(); got != "http://localhost:5173" {
		t.Fatalf("ค่าเริ่มต้นผิด: %q", got)
	}
	t.Setenv("APP_BASE_URL", " https://octavia.example.test ")
	if got := appBaseURL(); got != "https://octavia.example.test" {
		t.Fatalf("ต้อง trim ช่องว่าง แต่ได้ %q", got)
	}
}

func TestCustomerPasswordResetPostgreSQLFlow(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerCustomerAccountRoutes(app, db, sender, "http://localhost:5173")

	email := "reset.flow@example.test"
	oldPassword := "OldPass123!"
	newPassword := "BrandNewPass456!"
	registerBody := map[string]any{
		"first_name": "สมหญิง", "last_name": "ทดสอบ", "date_of_birth": "2000-01-01",
		"gender": "หญิง", "phone": "0812345678", "address": "กรุงเทพมหานคร",
		"email": email, "password": oldPassword,
	}
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/register", registerBody, nil, http.StatusCreated)

	// อีเมลผิดรูปแบบ ตอบ 400 (บอกว่าพิมพ์ผิด ไม่ได้เปิดเผยว่าใครมีบัญชี)
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/forgot-password",
		map[string]any{"email": "ไม่ใช่อีเมล"}, nil, http.StatusBadRequest)
	if sender.calls != 0 {
		t.Fatal("อีเมลผิดรูปแบบต้องไม่ส่งเมล")
	}

	// อีเมลที่ไม่มีบัญชี ต้องตอบ 204 เหมือนกรณีปกติ และต้องไม่ส่งเมล
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/forgot-password",
		map[string]any{"email": "nobody.here@example.test"}, nil, http.StatusNoContent)
	if sender.calls != 0 {
		t.Fatal("อีเมลที่ไม่มีบัญชีต้องไม่ส่งเมล แต่ต้องตอบ 204")
	}

	// อีเมลที่มีบัญชีจริง
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/forgot-password",
		map[string]any{"email": email}, nil, http.StatusNoContent)
	if sender.calls != 1 || sender.to != email {
		t.Fatalf("ควรส่งเมลหาผู้ใช้ 1 ฉบับ: calls=%d to=%q", sender.calls, sender.to)
	}

	matches := regexp.MustCompile(`token=([0-9a-f]{64})`).FindStringSubmatch(sender.body)
	if matches == nil {
		t.Fatalf("ไม่พบ token ในอีเมล: %s", sender.body)
	}
	token := matches[1]

	// token ดิบต้องไม่ถูกเก็บลงฐานข้อมูล
	var rawCount int64
	if err := db.Model(&models.CusActivityLogs{}).
		Where("action_type = ? AND target_id = ?", customerPasswordResetAction, token).
		Count(&rawCount).Error; err != nil {
		t.Fatal(err)
	}
	if rawCount != 0 {
		t.Fatal("token ดิบถูกเก็บลง DB ต้องเก็บเฉพาะ hash")
	}

	// รหัสผ่านใหม่สั้นเกินไป
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/reset-password",
		map[string]any{"token": token, "new_password": "sh0rt"}, nil, http.StatusBadRequest)

	// token มั่ว
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/reset-password",
		map[string]any{"token": strings.Repeat("f", 64), "new_password": newPassword}, nil, http.StatusBadRequest)

	// ตั้งรหัสผ่านใหม่สำเร็จ
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/reset-password",
		map[string]any{"token": token, "new_password": newPassword}, nil, http.StatusNoContent)

	// รหัสเดิมใช้ไม่ได้แล้ว รหัสใหม่ใช้ได้
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login",
		map[string]any{"email": email, "password": oldPassword}, nil, http.StatusUnauthorized)
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login",
		map[string]any{"email": email, "password": newPassword}, nil, http.StatusOK)

	// token ใช้ซ้ำไม่ได้
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/reset-password",
		map[string]any{"token": token, "new_password": "AnotherPass789!"}, nil, http.StatusBadRequest)
}

func TestCustomerPasswordResetRejectsExpiredToken(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerCustomerAccountRoutes(app, db, sender, "http://localhost:5173")

	email := "reset.expired@example.test"
	registerBody := map[string]any{
		"first_name": "สมชาย", "last_name": "ทดสอบ", "date_of_birth": "2000-01-01",
		"gender": "ชาย", "phone": "0898765432", "address": "กรุงเทพมหานคร",
		"email": email, "password": "OldPass123!",
	}
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/register", registerBody, nil, http.StatusCreated)
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/forgot-password",
		map[string]any{"email": email}, nil, http.StatusNoContent)

	token := regexp.MustCompile(`token=([0-9a-f]{64})`).FindStringSubmatch(sender.body)[1]

	// ย้อนวันหมดอายุให้เป็นอดีต
	expired := strconv.FormatInt(time.Now().UTC().Add(-time.Minute).Unix(), 10)
	if err := db.Model(&models.CusActivityLogs{}).
		Where("action_type = ? AND target_id = ?", customerPasswordResetAction, hashCustomerSessionToken(token)).
		Update("description", expired).Error; err != nil {
		t.Fatal(err)
	}

	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/reset-password",
		map[string]any{"token": token, "new_password": "BrandNewPass456!"}, nil, http.StatusBadRequest)

	// รหัสผ่านเดิมต้องยังใช้ได้ เพราะการรีเซ็ตไม่สำเร็จ
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login",
		map[string]any{"email": email, "password": "OldPass123!"}, nil, http.StatusOK)
}

func TestNormalizeCustomerPhoneIgnoresSpacesAndDashes(t *testing.T) {
	if got := normalizeCustomerPhone(" 081-234-5678 "); got != "0812345678" {
		t.Fatalf("got %q, want %q", got, "0812345678")
	}
}

func TestCustomerPhoneVerifiedPasswordRecoveryChangesPassword(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	registerCustomerAccountRoutes(app, db, &captureMailer{}, "http://localhost:5173")

	email := "phone.recovery@example.test"
	phone := "0812345678"
	oldPassword := "OldPass123!"
	newPassword := "BrandNewPass456!"
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/register", map[string]any{
		"first_name": "สมหญิง", "last_name": "ทดสอบ", "date_of_birth": "2000-01-01",
		"gender": "หญิง", "phone": phone, "address": "กรุงเทพมหานคร",
		"email": email, "password": oldPassword,
	}, nil, http.StatusCreated)

	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/password-recovery", map[string]any{
		"email": email, "phone": phone, "new_password": newPassword,
	}, nil, http.StatusNoContent)

	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login",
		map[string]any{"email": email, "password": oldPassword}, nil, http.StatusUnauthorized)
	customerTestRequest(t, app, http.MethodPost, "/api/customer/auth/login",
		map[string]any{"email": email, "password": newPassword}, nil, http.StatusOK)
}
