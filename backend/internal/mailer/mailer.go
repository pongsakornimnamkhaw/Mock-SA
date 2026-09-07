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
	"path/filepath"
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

// lastMailFile คือไฟล์ที่ LogMailer เขียนอีเมลฉบับล่าสุดทับไว้เสมอ เพื่อให้ dev
// หาลิงก์ (เช่นลิงก์รีเซ็ตรหัสผ่าน) ได้ง่ายกว่าไล่ดู log ของเซิร์ฟเวอร์ทั้งไฟล์
// เป็น var (ไม่ใช่ const) เพื่อให้เทสต์เปลี่ยนไปชี้ไฟล์ชั่วคราวได้
var lastMailFile = filepath.Join(os.TempDir(), "octavia-last-mail.txt")

// LogMailer พิมพ์อีเมลออก console แทนการส่งจริง ใช้ตอน dev ที่ไม่มี SMTP
type LogMailer struct{}

func (LogMailer) Send(to, subject, body string) error {
	message := "ถึง: " + to + "\nหัวข้อ: " + subject + "\n\n" + body + "\n"
	log.Printf("[mailer] ยังไม่ได้ตั้งค่า SMTP_HOST จึงไม่ได้ส่งอีเมลจริง\n%s", message)
	if err := os.WriteFile(lastMailFile, []byte(message), 0o600); err != nil {
		log.Printf("[mailer] เขียนไฟล์อีเมลล่าสุด (%s) ไม่สำเร็จ: %v", lastMailFile, err)
	}
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
