package mailer

import (
	"os"
	"path/filepath"
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

func TestLogMailerSendWritesLastMailFile(t *testing.T) {
	original := lastMailFile
	lastMailFile = filepath.Join(t.TempDir(), "last-mail.txt")
	defer func() { lastMailFile = original }()

	if err := (LogMailer{}).Send("user@example.test", "หัวข้อทดสอบ", "เนื้อความทดสอบ"); err != nil {
		t.Fatalf("Send ต้องไม่ error: %v", err)
	}

	content, err := os.ReadFile(lastMailFile)
	if err != nil {
		t.Fatalf("ไม่พบไฟล์สรุปอีเมลล่าสุด: %v", err)
	}
	for _, want := range []string{"user@example.test", "หัวข้อทดสอบ", "เนื้อความทดสอบ"} {
		if !strings.Contains(string(content), want) {
			t.Fatalf("ไฟล์ไม่มีข้อมูลที่คาด %q ในเนื้อหา:\n%s", want, content)
		}
	}
}

func TestLogMailerSendOverwritesPreviousMailFile(t *testing.T) {
	original := lastMailFile
	lastMailFile = filepath.Join(t.TempDir(), "last-mail.txt")
	defer func() { lastMailFile = original }()

	_ = (LogMailer{}).Send("first@example.test", "หัวข้อแรก", "เนื้อความแรก")
	_ = (LogMailer{}).Send("second@example.test", "หัวข้อสอง", "เนื้อความสอง")

	content, err := os.ReadFile(lastMailFile)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(content), "first@example.test") {
		t.Fatal("ไฟล์ควรมีแค่อีเมลล่าสุด ไม่ใช่สะสมของเก่าไว้")
	}
	if !strings.Contains(string(content), "second@example.test") {
		t.Fatalf("ไฟล์ต้องมีอีเมลล่าสุด: %s", content)
	}
}

func TestSMTPMailerRejectsEmptyRecipient(t *testing.T) {
	mailer := New(Config{Host: "smtp.example.test", Username: "u"}).(SMTPMailer)
	if err := mailer.Send("", "หัวข้อ", "เนื้อความ"); err == nil {
		t.Fatal("ส่งอีเมลโดยไม่มีปลายทางต้อง error ก่อนที่จะต่อ SMTP")
	}
}
