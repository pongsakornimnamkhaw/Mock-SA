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
