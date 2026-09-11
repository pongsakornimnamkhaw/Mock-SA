package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const employeePasswordSetupTTL = 30 * time.Minute

func employeePasswordSetupTokenHash(raw string) (string, error) {
	if len(raw) != 64 {
		return "", fiber.ErrBadRequest
	}
	if _, err := hex.DecodeString(raw); err != nil {
		return "", fiber.ErrBadRequest
	}
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:]), nil
}

func createEmployeePasswordSetupToken(db *gorm.DB, userID string, now time.Time) (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	raw := hex.EncodeToString(bytes)
	hash, _ := employeePasswordSetupTokenHash(raw)
	if err := db.Where("user_id = ?", userID).Delete(&models.EmployeePasswordSetupToken{}).Error; err != nil {
		return "", err
	}
	token := models.EmployeePasswordSetupToken{UserID: userID, TokenHash: hash, ExpiresAt: now.Add(employeePasswordSetupTTL), CreatedAt: now}
	if err := db.Create(&token).Error; err != nil {
		return "", err
	}
	return raw, nil
}

func registerEmployeePasswordSetupRoute(app *fiber.App, db *gorm.DB) {
	app.Post("/api/employee/auth/setup-password", func(c *fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		hash, err := employeePasswordSetupTokenHash(strings.TrimSpace(c.Get("X-Employee-Setup-Token")))
		if err != nil {
			return employeeAccountError(c, err)
		}
		var input struct {
			NewPassword     string `json:"new_password"`
			ConfirmPassword string `json:"confirm_password"`
		}
		if c.BodyParser(&input) != nil {
			return employeeAccountError(c, fiber.ErrBadRequest)
		}
		if err := validateNewEmployeePassword(input.NewPassword, input.ConfirmPassword); err != nil {
			return employeeAccountError(c, err)
		}
		err = db.Transaction(func(tx *gorm.DB) error {
			var token models.EmployeePasswordSetupToken
			if err := tx.Where("token_hash = ?", hash).First(&token).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return fiber.ErrBadRequest
				}
				return err
			}
			var user models.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "user_id = ? AND employee_inactive = ?", token.UserID, false).Error; err != nil {
				return fiber.ErrBadRequest
			}
			// Login also locks the employee before replacing setup tokens. Keep the
			// same lock order here so concurrent login/setup requests cannot deadlock.
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("token_hash = ? AND user_id = ?", hash, user.UserID).First(&token).Error; err != nil {
				return fiber.ErrBadRequest
			}
			now := time.Now().UTC()
			if token.UsedAt != nil || !now.Before(token.ExpiresAt) {
				return fiber.NewError(400, "ลิงก์ตั้งรหัสผ่านหมดอายุหรือถูกใช้งานแล้ว")
			}
			if !user.MustChangePassword {
				return fiber.NewError(400, "บัญชีนี้ตั้งรหัสผ่านแล้ว")
			}
			passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			if err := tx.Model(&user).Updates(map[string]any{"password_hash": string(passwordHash), "must_change_password": false}).Error; err != nil {
				return err
			}
			if err := tx.Model(&token).Update("used_at", now).Error; err != nil {
				return err
			}
			if err := tx.Where("user_id = ? AND token_id <> ?", user.UserID, token.TokenID).Delete(&models.EmployeePasswordSetupToken{}).Error; err != nil {
				return err
			}
			if err := tx.Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Delete(&models.EmpActivityLogs{}).Error; err != nil {
				return err
			}
			return tx.Create(&models.EmpActivityLogs{UserID: &user.UserID, ActionType: "ตั้งรหัสผ่านครั้งแรก", Description: "พนักงานตั้งรหัสผ่านส่วนตัวครั้งแรก", TargetID: user.UserID, Module: "บัญชี", CreatedAt: now.In(accountHistoryLocation)}).Error
		})
		if err != nil {
			return employeeAccountError(c, err)
		}
		clearEmployeeSessionCookie(c)
		return c.SendStatus(fiber.StatusNoContent)
	})
}
