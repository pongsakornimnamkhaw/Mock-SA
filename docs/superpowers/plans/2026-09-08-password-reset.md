# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้หน้า "ลืมรหัสผ่าน" ที่ตอนนี้เป็น mockup ใช้งานได้จริง — ส่งลิงก์รีเซ็ตทางอีเมล แล้วให้ลูกค้าตั้งรหัสผ่านใหม่ผ่านลิงก์นั้นได้

**Architecture:** เพิ่มแพ็กเกจ `backend/internal/mailer` ที่ห่อ `net/smtp` (stdlib ไม่เพิ่ม dependency) และตกกลับไปเป็น `LogMailer` เมื่อไม่ได้ตั้ง `SMTP_HOST` จากนั้นเพิ่ม endpoint `forgot-password` / `reset-password` ที่เก็บ token รีเซ็ตแบบ hash ไว้ในตาราง `cus_activity_logs` เดิม ด้วยรูปแบบเดียวกับที่ระบบเซสชันใช้อยู่แล้ว (ไม่สร้างตารางใหม่) ฝั่ง frontend ต่อฟอร์มเดิมเข้ากับ API และเพิ่มหน้า `/reset-password` ใหม่

**Tech Stack:** Go 1.26 + Fiber v2 + GORM + `net/smtp` + bcrypt (backend) · React 19 + TypeScript + MUI v9 + react-router v7 + Vitest (frontend)

**Spec:** `docs/superpowers/specs/2026-09-08-password-reset.md`

## Global Constraints

- ข้อความที่ผู้ใช้เห็นทุกจุดต้องเป็นภาษาไทย ให้เข้ากับข้อความเดิมในไฟล์เดียวกัน
- **ห้ามสร้างตารางใหม่ในฐานข้อมูล** — `backend/internal/handlers/customer_account_test.go:79` ยืนยันว่าจำนวนตารางต้องเป็น 40 พอดี การเพิ่มตารางจะทำให้เทสต์เดิมพัง
- **ห้ามเพิ่ม dependency ใหม่ใน `backend/go.mod`** — ใช้ `net/smtp` และ `mime` จาก stdlib
- Backend ตอบ error ด้วย `customerError(c, status, message)` เท่านั้น (รูปแบบ `{"error": "..."}`)
- Token รีเซ็ตต้องเก็บลง DB แบบ hash เท่านั้น (ใช้ `hashCustomerSessionToken` ที่มีอยู่แล้ว) ห้ามเก็บ token ดิบ
- อายุ token = 30 นาที (`customerPasswordResetTTL`)
- `POST /auth/forgot-password` ต้องคืน `204` เสมอเมื่ออีเมลถูกรูปแบบ ไม่ว่าบัญชีนั้นจะมีอยู่จริงหรือไม่
- รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร (กฎเดียวกับ `changePassword` เดิม)
- Import ฝั่ง frontend ใช้ alias `@/`
- คำสั่งทั้งหมดรันจาก `D:\SA\Mock-test\Mock-SA` (backend: `cd backend`, frontend: `cd frontend`)
- **เทสต์ integration ของ backend ถูก skip โดยค่าเริ่มต้น** ต้องรันด้วย `MANAGEMENT_INTEGRATION_TEST=1` และต้องมี PostgreSQL (`docker compose up -d postgres` ในโฟลเดอร์ `backend`) ถึงจะทำงานจริง
- ห้ามใส่บรรทัด attribution ใน commit message

## File Structure

**Backend**
- `backend/internal/mailer/mailer.go` (สร้าง) — interface `Mailer`, `SMTPMailer`, `LogMailer`, การอ่าน config จาก env, การประกอบข้อความอีเมล
- `backend/internal/mailer/mailer_test.go` (สร้าง) — เทสต์ของแพ็กเกจข้างบน
- `backend/internal/handlers/customer_password_reset.go` (สร้าง) — handler `forgotPassword` / `resetPassword` + ฟังก์ชัน pure ที่เทสต์ได้
- `backend/internal/handlers/customer_password_reset_test.go` (สร้าง) — unit test ของฟังก์ชัน pure + integration test ของ flow ทั้งเส้น
- `backend/internal/handlers/customer_account.go` (แก้) — เพิ่มฟิลด์ `mailer`/`baseURL` ใน struct, แยก `registerCustomerAccountRoutes` เพื่อให้เทสต์ฉีด mailer ปลอมได้, ลงทะเบียน 2 route ใหม่

**Frontend**
- `frontend/src/api/customerAccountApi.ts` (แก้) — เพิ่ม `forgotPassword` / `resetPassword`
- `frontend/src/api/customerAccountApi.test.ts` (สร้าง) — เทสต์ 2 เมธอดใหม่
- `frontend/src/components/common/ForgotPasswordForm.tsx` (แก้) — ต่อ API จริง + สถานะ loading/success/error
- `frontend/src/components/common/ForgotPasswordForm.test.tsx` (สร้าง)
- `frontend/src/components/common/ResetPasswordForm.tsx` (สร้าง) — ฟอร์มตั้งรหัสผ่านใหม่
- `frontend/src/components/common/ResetPasswordForm.test.tsx` (สร้าง)
- `frontend/src/pages/Login_page/ResetPassword/index.tsx` (สร้าง) — หน้าเปล่าครอบฟอร์ม รูปแบบเดียวกับหน้า ForgotPassword
- `frontend/src/App.tsx` (แก้ บรรทัด 78) — เพิ่ม route `/reset-password`

---

### Task 1: แพ็กเกจ `mailer` — ส่งอีเมลจริงถ้าตั้ง SMTP ไม่งั้น log ออก console

แพ็กเกจนี้ไม่รู้จักอะไรเกี่ยวกับโปรโมชั่น/ผู้ใช้/Fiber เลย รับแค่ปลายทาง หัวข้อ และเนื้อความ

**Files:**
- Create: `backend/internal/mailer/mailer.go`
- Test: `backend/internal/mailer/mailer_test.go`

**Interfaces:**
- Consumes: stdlib เท่านั้น (`net`, `net/smtp`, `mime`, `os`, `log`, `strings`, `errors`)
- Produces:
  - `type Mailer interface { Send(to, subject, body string) error }`
  - `type Config struct { Host, Port, Username, Password, From string }`
  - `func ConfigFromEnv() Config`
  - `func New(config Config) Mailer` — คืน `LogMailer{}` เมื่อ `Host` ว่าง ไม่งั้นคืน `SMTPMailer`
  - `func FromEnv() Mailer`
  - `type LogMailer struct{}` (มีเมธอด `Send`)
  - `type SMTPMailer struct{ ... }` (มีเมธอด `Send`)
  - `func BuildMessage(from, to, subject, body string) []byte`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/mailer/mailer_test.go`:

```go
package mailer

import (
	"strings"
	"testing"
)

func TestNewFallsBackToLogMailerWithoutHost(t *testing.T) {
	if _, ok := New(Config{}).(LogMailer); !ok {
		t.Fatal("ไม่มี SMTP_HOST ต้องได้ LogMailer เพื่อให้ dev รันได้โดยไม่ต้องตั้งค่า")
	}
	if _, ok := New(Config{Host: "   "}).(LogMailer); !ok {
		t.Fatal("host ที่มีแต่ช่องว่างต้องถือว่าไม่ได้ตั้งค่า")
	}
}

func TestNewUsesSMTPAndFillsDefaults(t *testing.T) {
	mailer, ok := New(Config{Host: "smtp.example.test", Username: "octavia@example.test"}).(SMTPMailer)
	if !ok {
		t.Fatal("เมื่อมี host ต้องได้ SMTPMailer")
	}
	if mailer.config.Port != "587" {
		t.Fatalf("พอร์ตเริ่มต้นควรเป็น 587 แต่ได้ %q", mailer.config.Port)
	}
	if mailer.config.From != "octavia@example.test" {
		t.Fatalf("ถ้าไม่ตั้ง From ควรใช้ Username แทน แต่ได้ %q", mailer.config.From)
	}
}

func TestNewKeepsExplicitPortAndFrom(t *testing.T) {
	mailer := New(Config{Host: "smtp.example.test", Port: "2525", Username: "u", From: "no-reply@example.test"}).(SMTPMailer)
	if mailer.config.Port != "2525" || mailer.config.From != "no-reply@example.test" {
		t.Fatalf("ค่าที่ตั้งเองต้องไม่ถูกทับ: %#v", mailer.config)
	}
}

func TestConfigFromEnvReadsAndTrims(t *testing.T) {
	t.Setenv("SMTP_HOST", "  smtp.example.test  ")
	t.Setenv("SMTP_PORT", " 2525 ")
	t.Setenv("SMTP_USERNAME", " octavia@example.test ")
	t.Setenv("SMTP_PASSWORD", "  secret  ")
	t.Setenv("SMTP_FROM", " no-reply@example.test ")

	config := ConfigFromEnv()
	if config.Host != "smtp.example.test" || config.Port != "2525" {
		t.Fatalf("host/port ไม่ถูก trim: %#v", config)
	}
	if config.Username != "octavia@example.test" || config.From != "no-reply@example.test" {
		t.Fatalf("username/from ไม่ถูก trim: %#v", config)
	}
	// รหัสผ่านอาจมีช่องว่างจริง จึงต้องไม่ถูก trim
	if config.Password != "  secret  " {
		t.Fatalf("ห้าม trim รหัสผ่าน แต่ได้ %q", config.Password)
	}
}

func TestBuildMessageEncodesThaiSubject(t *testing.T) {
	subject := "รีเซ็ตรหัสผ่าน Octavia"
	message := string(BuildMessage("no-reply@example.test", "user@example.test", subject, "เนื้อความ"))

	if strings.Contains(message, subject) {
		t.Fatal("หัวข้อภาษาไทยต้องถูกเข้ารหัสแบบ MIME encoded-word ไม่ใช่ส่งดิบ")
	}
	for _, header := range []string{
		"From: no-reply@example.test",
		"To: user@example.test",
		"Subject: =?utf-8?",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	} {
		if !strings.Contains(message, header) {
			t.Fatalf("ไม่พบ header %q ในข้อความ:\n%s", header, message)
		}
	}
	headerBlock, bodyBlock, found := strings.Cut(message, "\r\n\r\n")
	if !found {
		t.Fatal("ต้องมีบรรทัดว่างคั่นระหว่าง header กับเนื้อความ")
	}
	if bodyBlock != "เนื้อความ" {
		t.Fatalf("เนื้อความเพี้ยน: %q", bodyBlock)
	}
	if strings.Contains(headerBlock, "เนื้อความ") {
		t.Fatal("เนื้อความหลุดไปอยู่ในส่วน header")
	}
}

func TestLogMailerSendSucceeds(t *testing.T) {
	if err := (LogMailer{}).Send("user@example.test", "หัวข้อ", "เนื้อความ"); err != nil {
		t.Fatalf("LogMailer ต้องไม่ error: %v", err)
	}
}

func TestSMTPMailerRejectsEmptyRecipient(t *testing.T) {
	mailer := New(Config{Host: "smtp.example.test", Username: "u"}).(SMTPMailer)
	if err := mailer.Send("", "หัวข้อ", "เนื้อความ"); err == nil {
		t.Fatal("ส่งอีเมลโดยไม่มีปลายทางต้อง error ก่อนที่จะต่อ SMTP")
	}
}
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && go test ./internal/mailer/ -v
```

Expected: FAIL — `no Go files in ...\internal\mailer` หรือ compile error `undefined: New`

- [ ] **Step 3: เขียน implementation**

สร้าง `backend/internal/mailer/mailer.go`:

```go
// Package mailer ส่งอีเมลออกจากระบบ ถ้ายังไม่ได้ตั้งค่า SMTP จะพิมพ์อีเมลออก console แทน
// เพื่อให้เครื่อง dev ใช้งานฟีเจอร์ที่ต้องส่งอีเมลได้โดยไม่ต้องมีเซิร์ฟเวอร์เมลจริง
package mailer

import (
	"errors"
	"log"
	"mime"
	"net"
	"net/smtp"
	"os"
	"strings"
)

// Mailer ส่งอีเมลหนึ่งฉบับ ผู้เรียกไม่ต้องรู้ว่าเบื้องหลังเป็น SMTP จริงหรือแค่ log
type Mailer interface {
	Send(to, subject, body string) error
}

type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

func ConfigFromEnv() Config {
	return Config{
		Host:     strings.TrimSpace(os.Getenv("SMTP_HOST")),
		Port:     strings.TrimSpace(os.Getenv("SMTP_PORT")),
		Username: strings.TrimSpace(os.Getenv("SMTP_USERNAME")),
		// รหัสผ่านอาจมีช่องว่างที่มีความหมาย จึงไม่ trim
		Password: os.Getenv("SMTP_PASSWORD"),
		From:     strings.TrimSpace(os.Getenv("SMTP_FROM")),
	}
}

// New เลือกวิธีส่งจาก config: ไม่มี Host แปลว่ายังไม่ได้ตั้งค่าเมล ให้ log แทน
func New(config Config) Mailer {
	config.Host = strings.TrimSpace(config.Host)
	if config.Host == "" {
		return LogMailer{}
	}
	if strings.TrimSpace(config.Port) == "" {
		config.Port = "587"
	}
	if strings.TrimSpace(config.From) == "" {
		config.From = config.Username
	}
	return SMTPMailer{config: config}
}

func FromEnv() Mailer {
	return New(ConfigFromEnv())
}

// LogMailer พิมพ์อีเมลออก console แทนการส่งจริง ใช้ตอน dev ที่ไม่มี SMTP
type LogMailer struct{}

func (LogMailer) Send(to, subject, body string) error {
	log.Printf("[mailer] ยังไม่ได้ตั้งค่า SMTP_HOST จึงไม่ได้ส่งอีเมลจริง\nถึง: %s\nหัวข้อ: %s\n%s", to, subject, body)
	return nil
}

type SMTPMailer struct {
	config Config
}

func (m SMTPMailer) Send(to, subject, body string) error {
	if strings.TrimSpace(to) == "" {
		return errors.New("ไม่มีอีเมลปลายทาง")
	}
	address := net.JoinHostPort(m.config.Host, m.config.Port)
	auth := smtp.PlainAuth("", m.config.Username, m.config.Password, m.config.Host)
	return smtp.SendMail(address, auth, m.config.From, []string{to}, BuildMessage(m.config.From, to, subject, body))
}

// BuildMessage ประกอบอีเมลตาม RFC 5322 หัวข้อภาษาไทยต้องเข้ารหัสแบบ MIME encoded-word
// ไม่งั้นเซิร์ฟเวอร์เมลจะมองเป็นไบต์เพี้ยน
func BuildMessage(from, to, subject, body string) []byte {
	headers := []string{
		"From: " + from,
		"To: " + to,
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
	}
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body)
}
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd backend && go test ./internal/mailer/ -v
```

Expected: PASS ทั้ง 7 เทสต์

- [ ] **Step 5: ตรวจว่าไม่มี dependency ใหม่หลุดเข้ามา**

```bash
cd backend && go build ./... && git diff --stat go.mod go.sum
```

Expected: build ผ่าน และ `git diff` ของ `go.mod`/`go.sum` **ต้องว่างเปล่า** (ใช้ stdlib ล้วน)

- [ ] **Step 6: Commit**

```bash
git add backend/internal/mailer/mailer.go backend/internal/mailer/mailer_test.go
git commit -m "feat(backend): add mailer package with SMTP and console fallback"
```

---

### Task 2: Backend — endpoint `forgot-password` / `reset-password`

**Files:**
- Create: `backend/internal/handlers/customer_password_reset.go`
- Test: `backend/internal/handlers/customer_password_reset_test.go`
- Modify: `backend/internal/handlers/customer_account.go:29-31` (struct), `:75-90` (การลงทะเบียน route)

**Interfaces:**
- Consumes: `mailer.Mailer` / `mailer.FromEnv()` (Task 1), และของเดิมในแพ็กเกจ `handlers` —
  `customerAccountHandler`, `customerError(c, status, message)`, `normalizeCustomerEmail(value) (string, error)`,
  `hashCustomerSessionToken(token) string`, `clearCustomerSessionCookie(c)`, `customerSessionAction`,
  `models.User`, `models.CusActivityLogs`
- Produces:
  - `const customerPasswordResetAction = "AUTH_PASSWORD_RESET"`
  - `const customerPasswordResetTTL = 30 * time.Minute`
  - `func validateNewCustomerPassword(password string) error`
  - `func buildPasswordResetLink(baseURL, token string) string`
  - `func buildPasswordResetEmail(link string) (subject string, body string)`
  - `func newPasswordResetToken() (string, error)`
  - `func appBaseURL() string`
  - `func (h *customerAccountHandler) forgotPassword(c *fiber.Ctx) error`
  - `func (h *customerAccountHandler) resetPassword(c *fiber.Ctx) error`
  - `func registerCustomerAccountRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer, baseURL string)` — ตัวที่เทสต์ใช้ฉีด mailer ปลอม
  - HTTP: `POST /api/customer/auth/forgot-password`, `POST /api/customer/auth/reset-password`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/customer_password_reset_test.go`:

```go
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && go test ./internal/handlers/ -run "Password|AppBaseURL" -v
```

Expected: FAIL — compile error `undefined: validateNewCustomerPassword`, `undefined: registerCustomerAccountRoutes` ฯลฯ

- [ ] **Step 3: เขียน handler**

สร้าง `backend/internal/handlers/customer_password_reset.go`:

```go
package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const (
	customerPasswordResetAction = "AUTH_PASSWORD_RESET"
	customerPasswordResetTTL    = 30 * time.Minute
)

type customerForgotPasswordInput struct {
	Email string `json:"email"`
}

type customerResetPasswordInput struct {
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

// validateNewCustomerPassword ใช้กฎเดียวกับการเปลี่ยนรหัสผ่านในหน้าโปรไฟล์
func validateNewCustomerPassword(password string) error {
	if len(password) < 8 {
		return errors.New("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
	}
	return nil
}

func appBaseURL() string {
	if value := strings.TrimSpace(os.Getenv("APP_BASE_URL")); value != "" {
		return value
	}
	return "http://localhost:5173"
}

func buildPasswordResetLink(baseURL, token string) string {
	return strings.TrimRight(baseURL, "/") + "/reset-password?token=" + token
}

func buildPasswordResetEmail(link string) (string, string) {
	subject := "รีเซ็ตรหัสผ่าน Octavia"
	body := strings.Join([]string{
		"เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีนี้",
		"",
		"เปิดลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์ใช้ได้ 30 นาที และใช้ได้ครั้งเดียว)",
		link,
		"",
		"ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้งานได้ตามปกติ",
	}, "\r\n")
	return subject, body
}

func newPasswordResetToken() (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(tokenBytes), nil
}

func (h *customerAccountHandler) forgotPassword(c *fiber.Ctx) error {
	var input customerForgotPasswordInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "รูปแบบอีเมลไม่ถูกต้อง")
	}
	email, err := normalizeCustomerEmail(input.Email)
	if err != nil {
		return customerError(c, fiber.StatusBadRequest, "รูปแบบอีเมลไม่ถูกต้อง")
	}
	var user models.User
	err = h.db.Where("LOWER(email) = ? AND LOWER(user_type) IN ?", email, []string{"customer", "user", "ลูกค้า"}).First(&user).Error
	if err != nil {
		// ตอบเหมือนกรณีสำเร็จ เพื่อไม่ให้คนนอกเดาได้ว่าอีเมลไหนมีบัญชีอยู่
		return c.SendStatus(fiber.StatusNoContent)
	}
	token, err := newPasswordResetToken()
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถสร้างลิงก์รีเซ็ตรหัสผ่านได้")
	}
	now := time.Now().UTC()
	expiresAt := now.Add(customerPasswordResetTTL)
	// เก็บ token ในตารางเดิมด้วยรูปแบบเดียวกับเซสชัน: target_id = hash, description = เวลาหมดอายุ
	record := models.CusActivityLogs{
		CusLogID: "CL" + uuid.NewString(), UserID: user.UserID, ActionType: customerPasswordResetAction,
		TargetID: hashCustomerSessionToken(token), Description: strconv.FormatInt(expiresAt.Unix(), 10), CreatedAt: now,
	}
	if err := h.db.Create(&record).Error; err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถสร้างลิงก์รีเซ็ตรหัสผ่านได้")
	}
	_ = h.db.Where("action_type = ? AND description ~ '^[0-9]+$' AND CAST(description AS BIGINT) < ?", customerPasswordResetAction, now.Unix()).Delete(&models.CusActivityLogs{}).Error

	subject, body := buildPasswordResetEmail(buildPasswordResetLink(h.baseURL, token))
	if err := h.mailer.Send(user.Email, subject, body); err != nil {
		// ส่งเมลไม่ออกก็ยังตอบ 204 เพราะสถานะการส่งบอกใบ้ได้ว่าอีเมลนี้มีบัญชีอยู่
		log.Printf("[forgot-password] ส่งอีเมลไม่สำเร็จ: %v", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *customerAccountHandler) resetPassword(c *fiber.Ctx) error {
	var input customerResetPasswordInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "ข้อมูลรีเซ็ตรหัสผ่านไม่ถูกต้อง")
	}
	token := strings.TrimSpace(input.Token)
	if token == "" {
		return customerError(c, fiber.StatusBadRequest, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว")
	}
	if err := validateNewCustomerPassword(input.NewPassword); err != nil {
		return customerError(c, fiber.StatusBadRequest, err.Error())
	}
	var record models.CusActivityLogs
	if err := h.db.Where("action_type = ? AND target_id = ?", customerPasswordResetAction, hashCustomerSessionToken(token)).First(&record).Error; err != nil {
		return customerError(c, fiber.StatusBadRequest, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว")
	}
	expiresUnix, err := strconv.ParseInt(record.Description, 10, 64)
	if err != nil || expiresUnix <= time.Now().UTC().Unix() {
		_ = h.db.Delete(&record).Error
		return customerError(c, fiber.StatusBadRequest, "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถตั้งรหัสผ่านใหม่ได้")
	}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).Where("user_id = ?", record.UserID).Update("password_hash", string(hash)).Error; err != nil {
			return err
		}
		// ลิงก์ใช้ได้ครั้งเดียว และเตะทุกเซสชันเดิมออกเพราะรหัสผ่านเปลี่ยนไปแล้ว
		if err := tx.Where("user_id = ? AND action_type IN ?", record.UserID, []string{customerPasswordResetAction, customerSessionAction}).Delete(&models.CusActivityLogs{}).Error; err != nil {
			return err
		}
		return tx.Create(&models.CusActivityLogs{UserID: record.UserID, ActionType: "รีเซ็ตรหัสผ่าน", Description: "ลูกค้ารีเซ็ตรหัสผ่านผ่านลิงก์ในอีเมล", TargetID: record.UserID}).Error
	})
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถตั้งรหัสผ่านใหม่ได้")
	}
	clearCustomerSessionCookie(c)
	return c.SendStatus(fiber.StatusNoContent)
}
```

- [ ] **Step 4: เพิ่มฟิลด์ใน struct ของ handler**

ใน `backend/internal/handlers/customer_account.go` แก้ struct (บรรทัด 29–31) จาก

```go
type customerAccountHandler struct {
	db *gorm.DB
}
```

เป็น

```go
type customerAccountHandler struct {
	db      *gorm.DB
	mailer  mailer.Mailer
	baseURL string
}
```

แล้วเพิ่ม import `"backend/internal/mailer"` ต่อจากบรรทัด `"backend/internal/models"`

- [ ] **Step 5: แยกฟังก์ชันลงทะเบียน route แล้วเพิ่ม 2 route ใหม่**

แทนที่ `func RegisterCustomerAccountRoutes(...)` ทั้งก้อน (บรรทัด 75–90) ด้วย

```go
func RegisterCustomerAccountRoutes(app *fiber.App, db *gorm.DB) {
	registerCustomerAccountRoutes(app, db, mailer.FromEnv(), appBaseURL())
}

// registerCustomerAccountRoutes แยกออกมาเพื่อให้เทสต์ฉีด mailer ปลอมเข้ามาได้
func registerCustomerAccountRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer, baseURL string) {
	h := &customerAccountHandler{db: db, mailer: sender, baseURL: baseURL}
	group := app.Group("/api/customer")
	group.Post("/auth/register", h.register)
	group.Post("/auth/login", h.login)
	group.Post("/auth/logout", h.logout)
	group.Post("/auth/forgot-password", h.forgotPassword)
	group.Post("/auth/reset-password", h.resetPassword)
	group.Get("/promotions", h.listCustomerPromotions)
	group.Get("/promotions/redeem", h.redeemCustomerPromotion)
	group.Get("/promotions/:id", h.getCustomerPromotion)
	group.Get("/concerts/:id", h.getCustomerConcert)
	group.Get("/account", h.requireCustomer, h.getAccount)
	group.Patch("/account/profile", h.requireCustomer, h.updateProfile)
	group.Patch("/account/password", h.requireCustomer, h.changePassword)
	group.Get("/account/tickets", h.requireCustomer, h.listTickets)
	group.Get("/account/purchases", h.requireCustomer, h.listPurchases)
}
```

หมายเหตุ: `RegisterCustomerAccountRoutes(app, db)` ยังมีลายเซ็นเดิม เทสต์เก่าที่
`customer_account_test.go:84` และ `cmd/server/main.go:52` จึงไม่ต้องแก้

- [ ] **Step 6: รัน unit test (ส่วนที่ไม่ต้องใช้ฐานข้อมูล) ให้ผ่าน**

```bash
cd backend && go build ./... && go test ./internal/handlers/ -run "Password|AppBaseURL" -v
```

Expected: build ผ่าน · เทสต์ pure ทั้ง 5 ตัว PASS · เทสต์ที่ชื่อลงท้าย `PostgreSQLFlow` และ `RejectsExpiredToken` ขึ้น SKIP (ยังไม่ได้ตั้ง env)

- [ ] **Step 7: รัน integration test จริงกับ PostgreSQL**

ถ้ายังไม่ได้เปิดฐานข้อมูล เปิดก่อน:

```bash
cd backend && docker compose up -d postgres
```

แล้วรัน:

```bash
cd backend && MANAGEMENT_INTEGRATION_TEST=1 go test ./internal/handlers/ -run "Password" -v
```

Expected: `TestCustomerPasswordResetPostgreSQLFlow` และ `TestCustomerPasswordResetRejectsExpiredToken` PASS

- [ ] **Step 8: ตรวจว่าเทสต์เดิมทั้งหมดยังเขียว (รวมเทสต์ที่นับจำนวนตาราง = 40)**

```bash
cd backend && MANAGEMENT_INTEGRATION_TEST=1 go test ./... 2>&1 | tail -12
```

Expected: ทุก package `ok` — โดยเฉพาะ `TestCustomerAccountPostgreSQLFlow` ต้องไม่พังจากจำนวนตาราง

- [ ] **Step 9: บันทึกตัวแปรสภาพแวดล้อมใหม่ลง `.env.example` ถ้ามีไฟล์นี้**

```bash
ls backend/.env.example
```

ถ้ามีไฟล์อยู่ ให้เพิ่มต่อท้าย (ถ้าไม่มีไฟล์ ข้ามขั้นนี้ไป — `.env` จริงถูก gitignore ไว้ ห้าม commit):

```
# ปล่อยว่างได้ ถ้าไม่ตั้ง SMTP_HOST ระบบจะพิมพ์ลิงก์รีเซ็ตรหัสผ่านออก console แทนการส่งอีเมล
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
APP_BASE_URL=http://localhost:5173
```

- [ ] **Step 10: Commit**

```bash
git add backend/internal/handlers/customer_password_reset.go backend/internal/handlers/customer_password_reset_test.go backend/internal/handlers/customer_account.go
git commit -m "feat(backend): add forgot-password and reset-password endpoints"
```

---

### Task 3: Frontend — เพิ่ม `forgotPassword` / `resetPassword` ใน API client

**Files:**
- Modify: `frontend/src/api/customerAccountApi.ts` (เพิ่ม 2 เมธอดต่อจาก `changePassword`)
- Test: `frontend/src/api/customerAccountApi.test.ts` (สร้าง)

**Interfaces:**
- Consumes: endpoint จาก Task 2, helper `request<T>(path, init)` ที่มีอยู่แล้วในไฟล์
  (คืน `undefined` เมื่อได้ `204` และโยน `CustomerApiError(message, status)` เมื่อ backend ตอบ `{"error": "..."}`)
- Produces:
  - `customerAccountApi.forgotPassword(email: string): Promise<void>`
  - `customerAccountApi.resetPassword(token: string, newPassword: string): Promise<void>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/customerAccountApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomerApiError, customerAccountApi } from '@/api/customerAccountApi';

const noContent = () => new Response(null, { status: 204 });

const errorResponse = (status: number, message: string) => new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } },
);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('customerAccountApi.forgotPassword', () => {
    it('posts the email to the forgot-password endpoint', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

        await expect(customerAccountApi.forgotPassword('  User@Example.test ')).resolves.toBeUndefined();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('/api/customer/auth/forgot-password');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ email: '  User@Example.test ' });
    });

    it('surfaces a malformed-email rejection from the server', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse(400, 'รูปแบบอีเมลไม่ถูกต้อง'));

        await expect(customerAccountApi.forgotPassword('nope')).rejects.toThrow('รูปแบบอีเมลไม่ถูกต้อง');
    });
});

describe('customerAccountApi.resetPassword', () => {
    it('posts the token and the new password', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(noContent());

        await expect(customerAccountApi.resetPassword('abc123', 'BrandNewPass456!')).resolves.toBeUndefined();

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe('/api/customer/auth/reset-password');
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({ token: 'abc123', new_password: 'BrandNewPass456!' });
    });

    it('surfaces an expired-link rejection with its status', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            errorResponse(400, 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'),
        );

        await expect(customerAccountApi.resetPassword('stale', 'BrandNewPass456!'))
            .rejects.toMatchObject({ message: 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว', status: 400 });
    });

    it('reports an unreachable backend as a CustomerApiError with status 0', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('failed to fetch'));

        await expect(customerAccountApi.resetPassword('abc123', 'BrandNewPass456!'))
            .rejects.toBeInstanceOf(CustomerApiError);
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/api/customerAccountApi.test.ts
```

Expected: FAIL — `customerAccountApi.forgotPassword is not a function`

- [ ] **Step 3: เพิ่ม 2 เมธอดใน `frontend/src/api/customerAccountApi.ts`**

หาบรรทัด `changePassword: (currentPassword: string, newPassword: string) => request<void>('/account/password', {` แล้วเพิ่มต่อจากก้อนนั้น (ก่อน `async getTickets()`):

```ts
  forgotPassword: (email: string) => request<void>('/auth/forgot-password', {
    method: 'POST', body: JSON.stringify({ email }),
  }),

  resetPassword: (token: string, newPassword: string) => request<void>('/auth/reset-password', {
    method: 'POST', body: JSON.stringify({ token, new_password: newPassword }),
  }),
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/api/customerAccountApi.test.ts
```

Expected: PASS ทั้ง 5 เคส

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/customerAccountApi.ts frontend/src/api/customerAccountApi.test.ts
git commit -m "feat(frontend): add forgot-password and reset-password API client methods"
```

---

### Task 4: Frontend — ต่อ `ForgotPasswordForm` เข้ากับ API จริง

**Files:**
- Modify: `frontend/src/components/common/ForgotPasswordForm.tsx` (เขียนทับทั้งไฟล์)
- Test: `frontend/src/components/common/ForgotPasswordForm.test.tsx` (สร้าง)

**Interfaces:**
- Consumes: `customerAccountApi.forgotPassword(email)` (Task 3)
- Produces: `ForgotPasswordForm` (default export) — ไม่รับ props ยังคงเดิม

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/common/ForgotPasswordForm.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customerAccountApi } from '@/api/customerAccountApi';
import ForgotPasswordForm from '@/components/common/ForgotPasswordForm';

afterEach(() => {
    vi.restoreAllMocks();
});

const typeEmail = async (value: string) => {
    await userEvent.type(screen.getByLabelText('อีเมล'), value);
};

describe('ForgotPasswordForm', () => {
    it('sends the typed email and then shows a neutral confirmation', async () => {
        const forgotPassword = vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        await typeEmail('user@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        expect(forgotPassword).toHaveBeenCalledWith('user@example.test');
        expect(await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/)).toBeInTheDocument();
    });

    it('keeps the confirmation neutral so it never reveals whether the account exists', async () => {
        vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        await typeEmail('nobody@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        const confirmation = await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/);
        expect(confirmation.textContent).toMatch(/ถ้ามีบัญชี/);
    });

    it('shows the server error message when the email is malformed', async () => {
        vi.spyOn(customerAccountApi, 'forgotPassword').mockRejectedValue(new Error('รูปแบบอีเมลไม่ถูกต้อง'));
        render(<ForgotPasswordForm />);

        await typeEmail('nope');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        expect(await screen.findByText('รูปแบบอีเมลไม่ถูกต้อง')).toBeInTheDocument();
        expect(screen.queryByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/)).not.toBeInTheDocument();
    });

    it('does not submit an empty email', async () => {
        const forgotPassword = vi.spyOn(customerAccountApi, 'forgotPassword').mockResolvedValue(undefined);
        render(<ForgotPasswordForm />);

        expect(screen.getByRole('button', { name: 'ยืนยันอีเมล' })).toBeDisabled();
        expect(forgotPassword).not.toHaveBeenCalled();
    });

    it('disables the field and the button while the request is in flight', async () => {
        let release: () => void = () => {};
        vi.spyOn(customerAccountApi, 'forgotPassword').mockReturnValue(
            new Promise<void>((resolve) => { release = () => resolve(); }),
        );
        render(<ForgotPasswordForm />);

        await typeEmail('user@example.test');
        await userEvent.click(screen.getByRole('button', { name: 'ยืนยันอีเมล' }));

        await waitFor(() => expect(screen.getByLabelText('อีเมล')).toBeDisabled());
        release();
        await screen.findByText(/เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว/);
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/common/ForgotPasswordForm.test.tsx
```

Expected: FAIL — ฟอร์มเดิมไม่เรียก API ปุ่มไม่ disabled และไม่มีข้อความยืนยัน

- [ ] **Step 3: เขียนทับ `frontend/src/components/common/ForgotPasswordForm.tsx`**

```tsx
import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import { customerAccountApi } from '@/api/customerAccountApi'

const ForgotPasswordForm = () => {
    const [email, setEmail] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [sent, setSent] = useState(false)

    const canSubmit = email.trim() !== '' && !submitting

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        setSubmitting(true)
        setErrorMessage('')
        try {
            await customerAccountApi.forgotPassword(email)
            setSent(true)
        } catch (reason) {
            setErrorMessage(reason instanceof Error ? reason.message : 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    mb: 3,
                }}
            >
                <EmailIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="อีเมล"
                    type="email"
                    value={email}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    sx={{
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f5f5f5',
                                borderRadius: '15px',
                            },
                        }}
                />
            </Box>

            {/* ข้อความยืนยันต้องเป็นกลาง ไม่บอกว่าอีเมลนี้มีบัญชีอยู่จริงหรือไม่ */}
            {sent && (
                <Alert severity="success" sx={{ mb: 2, borderRadius: '15px' }}>
                    ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว กรุณาตรวจสอบกล่องจดหมาย (ลิงก์ใช้ได้ 30 นาที)
                </Alert>
            )}

            {errorMessage !== '' && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '15px' }}>
                    {errorMessage}
                </Alert>
            )}

            <Button variant="contained" type="submit" disabled={!canSubmit}
                sx={{
                    bgcolor: '#FF5A57',
                    borderRadius: '15px',
                    fontSize: '18px',
                    py: 1.5,
                    width: '80%',
                    display: 'flex',
                    justifyContent: 'center',
                    mx: 'auto',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#050C38' }
                }}
            >
                {submitting ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'ยืนยันอีเมล'}
            </Button>
        </Box>
    );
};

export default ForgotPasswordForm
```

หมายเหตุ: ตอน `submitting === true` ปุ่มแสดง spinner แทนคำว่า "ยืนยันอีเมล" — เทสต์ที่หาปุ่มด้วยชื่อจึงต้องหาก่อนกดส่ง หรือรอให้ request เสร็จก่อน

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/common/ForgotPasswordForm.test.tsx
```

Expected: PASS ทั้ง 5 เคส

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/common/ForgotPasswordForm.tsx frontend/src/components/common/ForgotPasswordForm.test.tsx
git commit -m "feat(frontend): wire forgot password form to the backend"
```

---

### Task 5: Frontend — หน้า `/reset-password` สำหรับตั้งรหัสผ่านใหม่

**Files:**
- Create: `frontend/src/components/common/ResetPasswordForm.tsx`
- Test: `frontend/src/components/common/ResetPasswordForm.test.tsx`
- Create: `frontend/src/pages/Login_page/ResetPassword/index.tsx`
- Modify: `frontend/src/App.tsx` (import ต่อจากบรรทัด 7 และ route ต่อจากบรรทัด 78)

**Interfaces:**
- Consumes: `customerAccountApi.resetPassword(token, newPassword)` (Task 3),
  `useSearchParams` / `useNavigate` จาก `react-router-dom` v7,
  `Logo` จาก `@/components/common/Logo` (ใช้ `variant="OC1"` เหมือนหน้า ForgotPassword)
- Produces:
  - `ResetPasswordForm` (default export) — อ่าน `?token=` จาก query string เอง ไม่รับ props
  - `ResetPasswordPage` (default export) — หน้าเปล่าครอบฟอร์ม
  - route `/reset-password`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/common/ResetPasswordForm.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { customerAccountApi } from '@/api/customerAccountApi';
import ResetPasswordForm from '@/components/common/ResetPasswordForm';

afterEach(() => {
    vi.restoreAllMocks();
});

const renderAt = (search: string) => render(
    <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <Routes>
            <Route path="/reset-password" element={<ResetPasswordForm />} />
            <Route path="/login" element={<div>หน้าเข้าสู่ระบบ</div>} />
        </Routes>
    </MemoryRouter>,
);

const fillPasswords = async (password: string, confirmation: string) => {
    await userEvent.type(screen.getByLabelText('รหัสผ่านใหม่'), password);
    await userEvent.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), confirmation);
};

describe('ResetPasswordForm', () => {
    it('sends the token from the query string with the new password', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(resetPassword).toHaveBeenCalledWith('abc123', 'BrandNewPass456!');
    });

    it('redirects to the login page after a successful reset', async () => {
        vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('หน้าเข้าสู่ระบบ')).toBeInTheDocument();
    });

    it('rejects a mismatched confirmation without calling the server', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('BrandNewPass456!', 'DifferentPass789!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('รหัสผ่านทั้งสองช่องไม่ตรงกัน')).toBeInTheDocument();
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it('rejects a password shorter than 8 characters without calling the server', async () => {
        const resetPassword = vi.spyOn(customerAccountApi, 'resetPassword').mockResolvedValue(undefined);
        renderAt('?token=abc123');

        await fillPasswords('sh0rt', 'sh0rt');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')).toBeInTheDocument();
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it('shows the server message when the link is expired', async () => {
        vi.spyOn(customerAccountApi, 'resetPassword').mockRejectedValue(
            new Error('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว'),
        );
        renderAt('?token=stale');

        await fillPasswords('BrandNewPass456!', 'BrandNewPass456!');
        await userEvent.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

        expect(await screen.findByText('ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว')).toBeInTheDocument();
    });

    it('explains that the link is broken when the token is missing entirely', () => {
        renderAt('');

        expect(screen.getByText(/ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'ตั้งรหัสผ่านใหม่' })).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/common/ResetPasswordForm.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/components/common/ResetPasswordForm"`

- [ ] **Step 3: เขียน `frontend/src/components/common/ResetPasswordForm.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, TextField } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { customerAccountApi } from '@/api/customerAccountApi'

const ResetPasswordForm = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const token = (searchParams.get('token') || '').trim()

    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    if (token === '') {
        return (
            <Alert severity="error" sx={{ borderRadius: '15px' }}>
                ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์ กรุณากดลิงก์จากอีเมลอีกครั้ง หรือขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน
            </Alert>
        )
    }

    const canSubmit = password !== '' && confirmation !== '' && !submitting

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canSubmit) return
        // ตรวจฝั่ง client ก่อน เพื่อไม่ต้องยิงเซิร์ฟเวอร์สำหรับความผิดพลาดที่เห็นได้ทันที
        if (password.length < 8) {
            setErrorMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
            return
        }
        if (password !== confirmation) {
            setErrorMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน')
            return
        }
        setSubmitting(true)
        setErrorMessage('')
        try {
            await customerAccountApi.resetPassword(token, password)
            navigate('/login', { replace: true })
        } catch (reason) {
            setErrorMessage(reason instanceof Error ? reason.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้')
            setSubmitting(false)
        }
    }

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="รหัสผ่านใหม่"
                    type="password"
                    value={password}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <LockIcon sx={{ color: '#333' }} />
                <TextField
                    fullWidth
                    label="ยืนยันรหัสผ่านใหม่"
                    type="password"
                    value={confirmation}
                    disabled={submitting}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmation(e.target.value)}
                    sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#f5f5f5', borderRadius: '15px' } }}
                />
            </Box>

            {errorMessage !== '' && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '15px' }}>
                    {errorMessage}
                </Alert>
            )}

            <Button variant="contained" type="submit" disabled={!canSubmit}
                sx={{
                    bgcolor: '#FF5A57',
                    borderRadius: '15px',
                    fontSize: '18px',
                    py: 1.5,
                    width: '80%',
                    display: 'flex',
                    justifyContent: 'center',
                    mx: 'auto',
                    fontWeight: 'bold',
                    '&:hover': { bgcolor: '#050C38' }
                }}
            >
                {submitting ? <CircularProgress size={24} sx={{ color: '#ffffff' }} /> : 'ตั้งรหัสผ่านใหม่'}
            </Button>
        </Box>
    );
};

export default ResetPasswordForm
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/common/ResetPasswordForm.test.tsx
```

Expected: PASS ทั้ง 6 เคส

- [ ] **Step 5: สร้างหน้า `frontend/src/pages/Login_page/ResetPassword/index.tsx`**

โครงเหมือนหน้า ForgotPassword ทุกอย่าง เปลี่ยนแค่หัวข้อกับฟอร์ม:

```tsx
import { Box, Paper, Typography } from '@mui/material'
import Logo from '@/components/common/Logo'
import ResetPasswordForm from '@/components/common/ResetPasswordForm'

const ResetPasswordPage = () => {
    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: '#050C38', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
        }}>
            <Paper elevation={3} 
                sx={{ 
                    width: '500px', 
                    maxWidth: '600px', 
                    borderRadius: 5, 
                    p: 5, 
                    display: 'flex', 
                    flexDirection: 'column'
                }}
            >
                    <Logo variant="OC1" width={200} />

                    <Typography variant="h5" sx={{ fontWeight: 'bold', fontSize: '32px', color: '#000000', textAlign: 'center' }}>
                        ตั้งรหัสผ่านใหม่
                    </Typography>

                    <Typography sx={{ fontSize: '18px', textAlign: 'center', color: '#000000', mb: 2 }}>
                        กรอกรหัสผ่านใหม่ที่ต้องการใช้
                    </Typography>

                    <ResetPasswordForm />

            </Paper>
        </Box>
    );
};

export default ResetPasswordPage;
```

- [ ] **Step 6: ลงทะเบียน route ใน `frontend/src/App.tsx`**

เพิ่ม import ต่อจากบรรทัด 7 (`import ForgotPasswordPage from './pages/Login_page/ForgotPassword'`):

```tsx
import ResetPasswordPage from './pages/Login_page/ResetPassword'
```

แล้วเพิ่ม route ต่อจากบรรทัด 78 (`<Route path="/forgot-password" ... />`):

```tsx
      <Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Step 7: ตรวจ type, lint และเทสต์ทั้งหมด**

```bash
cd frontend && npm run lint && npm test -- --run
```

Expected: lint ผ่าน (exit 0) · เทสต์ทั้งหมด PASS

หมายเหตุ: `npx tsc -b` ในโปรเจกต์นี้มี error ค้างอยู่ก่อนแล้วที่ไม่เกี่ยวกับงานนี้
(`axios` ไม่ได้อยู่ใน package.json แต่ `src/services/https/index.ts` import ไว้ และปัญหาตัวพิมพ์ใหญ่-เล็กของโฟลเดอร์
`LOGO`/`logo`, `Poster`/`poster` บน Windows) — ให้ตรวจว่า **ไม่มี error ใหม่** ที่ชี้ไปยังไฟล์ที่แก้ใน task นี้:

```bash
cd frontend && npx tsc -b 2>&1 | grep -i "ResetPassword\|ForgotPassword\|customerAccountApi"
```

Expected: ไม่มีบรรทัดที่เป็น `error TS...` ของไฟล์เหล่านี้

- [ ] **Step 8: ตรวจของจริงในเบราว์เซอร์แบบครบวง**

8.1 เปิด PostgreSQL และ backend (ไม่ต้องตั้ง `SMTP_HOST` — ลิงก์จะถูก log ออก console):

```bash
cd backend && docker compose up -d postgres
```

จากนั้นรัน backend ไว้เบื้องหลังแล้วเปิด frontend dev server ด้วย `preview_start`

8.2 ตรวจตามลำดับนี้:
- เปิด `/forgot-password` กรอกอีเมลของบัญชีที่มีจริง กด "ยืนยันอีเมล" → ต้องขึ้นข้อความสีเขียว
  "ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว..."
- ดู console ของ backend → ต้องเห็นบล็อก `[mailer] ยังไม่ได้ตั้งค่า SMTP_HOST...` พร้อมลิงก์
  `http://localhost:5173/reset-password?token=<64 hex>`
- กรอกอีเมลที่ไม่มีบัญชี → ต้องได้ข้อความสีเขียวอันเดียวกัน (ไม่บอกว่าไม่มีบัญชี) และ console ต้องไม่มีอีเมลใหม่
- เปิดลิงก์ที่ได้จาก console (เปลี่ยนพอร์ตให้ตรงกับ dev server จริงถ้าไม่ใช่ 5173)
  → กรอกรหัสผ่านใหม่ไม่ตรงกัน 2 ช่อง → ขึ้น "รหัสผ่านทั้งสองช่องไม่ตรงกัน"
  → กรอกรหัสสั้นกว่า 8 ตัว → ขึ้น "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"
  → กรอกให้ถูก → เด้งไปหน้า `/login`
- เข้าสู่ระบบด้วยรหัสผ่านใหม่ → ต้องเข้าได้ · ด้วยรหัสเดิม → ต้องเข้าไม่ได้
- เปิดลิงก์เดิมซ้ำอีกครั้ง แล้วกดตั้งรหัสผ่าน → ต้องขึ้น "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว"
- เปิด `/reset-password` เปล่าๆ ไม่มี `?token=` → ต้องขึ้น "ลิงก์รีเซ็ตรหัสผ่านไม่สมบูรณ์..." และไม่มีปุ่ม

8.3 เช็ค `read_console_messages` ว่าไม่มี error ของแอป (404/400 ที่เกิดจากเคสทดสอบข้างบนถือว่าปกติ)
แล้วเก็บ screenshot ของหน้า `/reset-password` ส่งให้เจ้าของงาน

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/common/ResetPasswordForm.tsx frontend/src/components/common/ResetPasswordForm.test.tsx frontend/src/pages/Login_page/ResetPassword/index.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add reset password page"
```

---

## Notes for the executor

- **ทำไมถึงใช้ตาราง `cus_activity_logs` เก็บ token:** ระบบเซสชันเดิมทำแบบนี้อยู่แล้ว
  (`startSession` ที่ `customer_account.go:211`) และเทสต์ `customer_account_test.go:79`
  ยืนยันว่าจำนวนตารางต้องเป็น 40 พอดี การเพิ่มตารางใหม่จะทำให้เทสต์เดิมพัง
- **ทำไม `forgot-password` ถึงตอบ 204 แม้ไม่มีบัญชี:** เป็นข้อกำหนดด้านความปลอดภัยจาก spec
  (กัน account enumeration) ถ้าเห็นว่า "แปลก" อย่าเปลี่ยนเป็น 404
- **`h.mailer.Send` ล้มเหลวแล้วยังตอบ 204:** ตั้งใจ เพราะสถานะการส่งเมลบอกใบ้ได้ว่าอีเมลนี้มีบัญชีอยู่
  ความล้มเหลวถูก log ไว้แล้ว
- **ถ้า integration test ขึ้น SKIP:** แปลว่ายังไม่ได้ตั้ง `MANAGEMENT_INTEGRATION_TEST=1`
  ไม่ใช่ว่าเทสต์ผ่าน — ต้องรันแบบตั้ง env ให้เห็นผลจริงก่อนถือว่า Task 2 เสร็จ
- **อย่า commit ไฟล์ `backend/.env`** — ถูก gitignore ไว้และมีรหัสผ่านฐานข้อมูล
