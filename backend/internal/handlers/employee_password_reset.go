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
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type employeePasswordResetHandler struct{ db *gorm.DB }

type employeeResetDecisionInput struct {
	Decision      string `json:"decision"`
	PhoneVerified bool   `json:"phone_verified"`
	Reason        string `json:"reason"`
}

type employeeResetAdminDTO struct {
	RequestID       string     `json:"request_id"`
	ReferenceCode   string     `json:"reference_code"`
	Status          string     `json:"status"`
	UserID          string     `json:"user_id"`
	EmployeeCode    string     `json:"employee_code"`
	Name            string     `json:"name"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone"`
	RejectionReason string     `json:"rejection_reason"`
	ApprovedBy      *string    `json:"approved_by"`
	PhoneVerifiedAt *time.Time `json:"phone_verified_at"`
	ApprovedAt      *time.Time `json:"approved_at"`
	ExpiresAt       *time.Time `json:"expires_at"`
	UsedAt          *time.Time `json:"used_at"`
	CreatedAt       time.Time  `json:"created_at"`
}

func registerEmployeePasswordResetRoutes(app *fiber.App, db *gorm.DB, auth *employeeAuthHandler) {
	// The application enables SQL logging globally. Never log reset credentials,
	// including the bcrypt hash in the password UPDATE or the browser token hash.
	if db != nil {
		db = db.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)})
	}
	h := &employeePasswordResetHandler{db: db}
	public := app.Group("/api/employee/auth/password-reset", func(c *fiber.Ctx) error {
		c.Set("Cache-Control", "no-store")
		return c.Next()
	})
	public.Post("/requests", h.createRequest)
	public.Get("/status", h.status)
	public.Post("/complete", h.complete)
	admin := app.Group("/api/employee/password-reset-requests", auth.requireAdmin)
	admin.Get("/", h.list)
	admin.Get("/count", h.count)
	admin.Patch("/:id", h.decide)
}

func (h *employeePasswordResetHandler) createRequest(c *fiber.Ctx) error {
	var input struct {
		Identifier string `json:"identifier"`
	}
	if err := c.BodyParser(&input); err != nil {
		return employeeAccountError(c, fiber.ErrBadRequest)
	}
	identifier := strings.TrimSpace(input.Identifier)
	if identifier == "" || len(identifier) > 320 {
		return employeeAccountError(c, fiber.ErrBadRequest)
	}
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return employeeAccountError(c, err)
	}
	referenceBytes := make([]byte, 8)
	if _, err := rand.Read(referenceBytes); err != nil {
		return employeeAccountError(c, err)
	}
	token := hex.EncodeToString(tokenBytes)
	reference := "RST-" + strings.ToUpper(hex.EncodeToString(referenceBytes))
	var user models.User
	err := h.db.Select("user_id").Where(
		"(LOWER(email) = ? OR UPPER(employee_code) = ?) AND employee_inactive = ? AND (LOWER(user_type) IN ? OR employee_code IS NOT NULL)",
		strings.ToLower(identifier), strings.ToUpper(identifier), false, []string{"employee", "staff", "admin", "พนักงาน"},
	).First(&user).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return employeeAccountError(c, err)
	}
	if err == nil {
		sum := sha256.Sum256([]byte(token))
		request := models.EmployeePasswordResetRequest{
			RequestID: "ER" + uuid.NewString(), ReferenceCode: reference, UserID: user.UserID,
			BrowserTokenHash: hex.EncodeToString(sum[:]), Status: models.EmployeeResetPending, CreatedAt: time.Now().UTC(),
		}
		if err := h.db.Create(&request).Error; err != nil {
			return employeeAccountError(c, err)
		}
	}
	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"reference_code": reference, "browser_token": token,
		"message": "หากข้อมูลตรงกับบัญชีพนักงาน ผู้ดูแลระบบจะตรวจสอบคำขอและโทรกลับเพื่อยืนยันตัวตน",
	})
}

func employeeResetTokenHash(c *fiber.Ctx) (string, error) {
	token := c.Get("X-Employee-Reset-Token")
	if len(token) != 64 {
		return "", fiber.ErrBadRequest
	}
	if _, err := hex.DecodeString(token); err != nil {
		return "", fiber.ErrBadRequest
	}
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:]), nil
}

func employeeResetStatus(request models.EmployeePasswordResetRequest, now time.Time) string {
	if request.Status == models.EmployeeResetApproved && (request.ExpiresAt == nil || !now.Before(*request.ExpiresAt)) {
		return models.EmployeeResetExpired
	}
	return request.Status
}

func employeeResetPublicView(request models.EmployeePasswordResetRequest, now time.Time) fiber.Map {
	status := employeeResetStatus(request, now)
	view := fiber.Map{"status": status}
	if status == models.EmployeeResetRejected {
		view["rejection_reason"] = request.RejectionReason
	}
	return view
}

func (h *employeePasswordResetHandler) status(c *fiber.Ctx) error {
	hash, err := employeeResetTokenHash(c)
	if err != nil {
		return employeeAccountError(c, err)
	}
	var request models.EmployeePasswordResetRequest
	err = h.db.Where("browser_token_hash = ?", hash).First(&request).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Unknown identifiers get the same pending status as real new requests.
		return c.JSON(fiber.Map{"status": models.EmployeeResetPending})
	}
	if err != nil {
		return employeeAccountError(c, err)
	}
	return c.JSON(employeeResetPublicView(request, time.Now().UTC()))
}

func (h *employeePasswordResetHandler) list(c *fiber.Ctx) error {
	c.Set("Cache-Control", "no-store")
	page, err := employeeActivityPositiveInt(c.Query("page"), 1)
	if err != nil {
		return employeeAccountError(c, err)
	}
	pageSize, err := employeeActivityPositiveInt(c.Query("page_size"), 20)
	if err != nil {
		return employeeAccountError(c, err)
	}
	if pageSize > 50 {
		pageSize = 50
	}
	query := h.db.Model(&models.EmployeePasswordResetRequest{})
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return employeeAccountError(c, err)
	}
	var requests []models.EmployeePasswordResetRequest
	if err := query.Order("created_at DESC, request_id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&requests).Error; err != nil {
		return employeeAccountError(c, err)
	}
	data := make([]employeeResetAdminDTO, 0, len(requests))
	for _, request := range requests {
		var user models.User
		if err := h.db.Select("user_id", "employee_code", "first_name", "last_name", "email", "phone_number").First(&user, "user_id = ?", request.UserID).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return employeeAccountError(c, err)
		}
		code := ""
		if user.EmployeeCode != nil {
			code = *user.EmployeeCode
		}
		data = append(data, employeeResetAdminDTO{
			RequestID: request.RequestID, ReferenceCode: request.ReferenceCode, Status: employeeResetStatus(request, time.Now().UTC()),
			UserID: request.UserID, EmployeeCode: code, Name: strings.TrimSpace(user.FirstName + " " + user.LastName), Email: user.Email, Phone: user.PhoneNumber,
			RejectionReason: request.RejectionReason, ApprovedBy: request.ApprovedBy, PhoneVerifiedAt: request.PhoneVerifiedAt,
			ApprovedAt: request.ApprovedAt, ExpiresAt: request.ExpiresAt, UsedAt: request.UsedAt, CreatedAt: request.CreatedAt,
		})
	}
	return c.JSON(fiber.Map{"data": data, "total": total, "page": page, "page_size": pageSize})
}

func (h *employeePasswordResetHandler) count(c *fiber.Ctx) error {
	c.Set("Cache-Control", "no-store")
	var count int64
	if err := h.db.Model(&models.EmployeePasswordResetRequest{}).Where("status = ?", models.EmployeeResetPending).Count(&count).Error; err != nil {
		return employeeAccountError(c, err)
	}
	return c.JSON(fiber.Map{"count": count})
}

func (h *employeePasswordResetHandler) decide(c *fiber.Ctx) error {
	var input employeeResetDecisionInput
	if err := c.BodyParser(&input); err != nil {
		return employeeAccountError(c, fiber.ErrBadRequest)
	}
	input.Reason = strings.TrimSpace(input.Reason)
	if (input.Decision != "approve" && input.Decision != "reject") ||
		(input.Decision == "approve" && !input.PhoneVerified) ||
		(input.Decision == "reject" && input.Reason == "") {
		return employeeAccountError(c, fiber.ErrBadRequest)
	}
	admin := currentEmployee(c)
	var status string
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var request models.EmployeePasswordResetRequest
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&request, "request_id = ?", c.Params("id")).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fiber.ErrNotFound
			}
			return err
		}
		if request.Status != models.EmployeeResetPending {
			return fiber.NewError(fiber.StatusConflict, "คำขอนี้ได้รับการดำเนินการแล้ว")
		}
		updates := map[string]any{}
		if input.Decision == "approve" {
			now := time.Now().UTC()
			status = models.EmployeeResetApproved
			updates = map[string]any{"status": status, "approved_by": admin.UserID, "phone_verified_at": now, "approved_at": now, "expires_at": now.Add(30 * time.Minute)}
		} else {
			status = models.EmployeeResetRejected
			updates = map[string]any{"status": status, "rejection_reason": input.Reason}
		}
		return tx.Model(&request).Updates(updates).Error
	})
	if err != nil {
		return employeeAccountError(c, err)
	}
	return c.JSON(fiber.Map{"status": status})
}

func (h *employeePasswordResetHandler) complete(c *fiber.Ctx) error {
	hash, err := employeeResetTokenHash(c)
	if err != nil {
		return employeeAccountError(c, err)
	}
	var input struct {
		NewPassword     string `json:"new_password"`
		ConfirmPassword string `json:"confirm_password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return employeeAccountError(c, fiber.ErrBadRequest)
	}
	if err := validateNewEmployeePassword(input.NewPassword, input.ConfirmPassword); err != nil {
		return employeeAccountError(c, err)
	}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var request models.EmployeePasswordResetRequest
		if err := tx.Where("browser_token_hash = ?", hash).First(&request).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fiber.ErrBadRequest
			}
			return err
		}
		// Serialize resets for this account before locking its requests. This also
		// prevents two approved browser tokens from both completing concurrently.
		var user models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "user_id = ? AND employee_inactive = ?", request.UserID, false).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fiber.ErrBadRequest
			}
			return err
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&request, "request_id = ? AND browser_token_hash = ?", request.RequestID, hash).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		if employeeResetStatus(request, now) != models.EmployeeResetApproved {
			return fiber.NewError(fiber.StatusBadRequest, "คำขอนี้ไม่สามารถใช้รีเซ็ตรหัสผ่านได้")
		}
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if err := tx.Model(&user).Update("password_hash", string(passwordHash)).Error; err != nil {
			return err
		}
		if err := tx.Model(&request).Updates(map[string]any{"status": models.EmployeeResetUsed, "used_at": now}).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND action_type = ?", user.UserID, employeeSessionAction).Delete(&models.EmpActivityLogs{}).Error; err != nil {
			return err
		}
		// Invalidate every other live recovery capability, including approvals
		// issued before this password was changed.
		if err := tx.Model(&models.EmployeePasswordResetRequest{}).Where("user_id = ? AND request_id <> ? AND status IN ?", user.UserID, request.RequestID, []string{models.EmployeeResetPending, models.EmployeeResetApproved}).Update("status", models.EmployeeResetExpired).Error; err != nil {
			return err
		}
		return tx.Create(&models.EmpActivityLogs{
			UserID: &user.UserID, ActionType: "รีเซ็ตรหัสผ่าน", Description: "พนักงานรีเซ็ตรหัสผ่านหลังผู้ดูแลระบบยืนยันตัวตนทางโทรศัพท์",
			TargetID: user.UserID, Module: "บัญชี", CreatedAt: now.In(accountHistoryLocation),
		}).Error
	})
	if err != nil {
		return employeeAccountError(c, err)
	}
	clearEmployeeSessionCookie(c)
	return c.SendStatus(fiber.StatusNoContent)
}
