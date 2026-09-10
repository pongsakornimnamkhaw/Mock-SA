package handlers

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type employeeAccountHandler struct {
	db *gorm.DB
}

type employeeProfileInput struct {
	Email string `json:"email"`
	Phone string `json:"phone"`
}

type employeePasswordInput struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
	ConfirmPassword string `json:"confirm_password"`
}

func registerEmployeeAccountRoutes(app *fiber.App, db *gorm.DB, auth *employeeAuthHandler) {
	h := &employeeAccountHandler{db: db}
	group := app.Group("/api/employee/account", auth.requireEmployee)
	group.Get("/", h.getAccount)
	group.Patch("/profile", h.updateProfile)
	group.Patch("/password", h.updatePassword)
	group.Get("/activity", h.listActivity)
}

func (h *employeeAccountHandler) getAccount(c *fiber.Ctx) error {
	view := employeeAuthAccountView(currentEmployee(c))
	var login models.EmpActivityLogs
	if err := h.db.Where("user_id = ? AND action_type = ?", view.UserID, "เข้าสู่ระบบ").
		Order("created_at DESC, emp_log_id DESC").First(&login).Error; err == nil {
		lastLogin := thailandWallTime(login.CreatedAt)
		view.LastLoginAt = &lastLogin
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return employeeAccountError(c, err)
	}
	return c.JSON(fiber.Map{"data": view})
}

func (h *employeeAccountHandler) updateProfile(c *fiber.Ctx) error {
	var input employeeProfileInput
	if err := c.BodyParser(&input); err != nil {
		return employeeAccountError(c, fiber.NewError(fiber.StatusBadRequest, "รูปแบบข้อมูลไม่ถูกต้อง"))
	}
	user := currentEmployee(c)
	requestedEmail := strings.ToLower(strings.TrimSpace(input.Email))
	if user.PersonnelType != models.PersonnelTypeExternal &&
		!strings.EqualFold(requestedEmail, strings.TrimSpace(user.Email)) {
		return employeeAccountError(c, fiber.NewError(fiber.StatusForbidden, "บุคลากรภายในไม่สามารถแก้ไขอีเมลได้"))
	}

	validated := employeeView(user)
	validated.Email = input.Email
	validated.Phone = input.Phone
	if err := validateEmployee(&validated); err != nil {
		return employeeAccountError(c, err)
	}
	if user.PersonnelType != models.PersonnelTypeExternal {
		validated.Email = user.Email
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if user.PersonnelType == models.PersonnelTypeExternal {
			var duplicates int64
			if err := tx.Model(&models.User{}).
				Where("LOWER(email) = ? AND user_id <> ?", validated.Email, user.UserID).
				Count(&duplicates).Error; err != nil {
				return err
			}
			if duplicates > 0 {
				return fiber.NewError(fiber.StatusConflict, "อีเมลนี้มีอยู่ในระบบแล้ว")
			}
		}
		if err := tx.Model(&models.User{}).Where("user_id = ?", user.UserID).Updates(map[string]any{
			"email": validated.Email, "phone_number": validated.Phone,
		}).Error; err != nil {
			return err
		}
		userID := user.UserID
		return tx.Create(&models.EmpActivityLogs{
			UserID: &userID, ActionType: "แก้ไขบัญชี", Description: "พนักงานแก้ไขข้อมูลบัญชีของตนเอง",
			TargetID: user.UserID, Module: "บัญชี", CreatedAt: time.Now().In(accountHistoryLocation),
		}).Error
	})
	if err != nil {
		return employeeAccountError(c, err)
	}
	user.Email = validated.Email
	user.PhoneNumber = validated.Phone
	return c.JSON(fiber.Map{"data": employeeAuthAccountView(user)})
}

func validateNewEmployeePassword(password, confirmation string) error {
	if len(password) < 8 {
		return fiber.NewError(fiber.StatusBadRequest, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
	}
	if password != confirmation {
		return fiber.NewError(fiber.StatusBadRequest, "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน")
	}
	return nil
}

func (h *employeeAccountHandler) updatePassword(c *fiber.Ctx) error {
	var input employeePasswordInput
	if err := c.BodyParser(&input); err != nil {
		return employeeAccountError(c, fiber.NewError(fiber.StatusBadRequest, "รูปแบบข้อมูลไม่ถูกต้อง"))
	}
	if err := validateNewEmployeePassword(input.NewPassword, input.ConfirmPassword); err != nil {
		return employeeAccountError(c, err)
	}
	user := currentEmployee(c)
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.CurrentPassword)) != nil {
		return employeeAccountError(c, fiber.NewError(fiber.StatusBadRequest, "รหัสผ่านปัจจุบันไม่ถูกต้อง"))
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return employeeAccountError(c, err)
	}
	currentSessionHash := hashEmployeeSessionToken(employeeTokenFromRequest(c))
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).Where("user_id = ?", user.UserID).
			Update("password_hash", string(passwordHash)).Error; err != nil {
			return err
		}
		if err := tx.Where(
			"user_id = ? AND action_type = ? AND target_id <> ?",
			user.UserID, employeeSessionAction, currentSessionHash,
		).Delete(&models.EmpActivityLogs{}).Error; err != nil {
			return err
		}
		userID := user.UserID
		return tx.Create(&models.EmpActivityLogs{
			UserID: &userID, ActionType: "เปลี่ยนรหัสผ่าน", Description: "พนักงานเปลี่ยนรหัสผ่าน",
			TargetID: user.UserID, Module: "บัญชี", CreatedAt: time.Now().In(accountHistoryLocation),
		}).Error
	})
	if err != nil {
		return employeeAccountError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *employeeAccountHandler) listActivity(c *fiber.Ctx) error {
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

	user := currentEmployee(c)
	query := h.db.Model(&models.EmpActivityLogs{}).
		Where("user_id = ? AND action_type <> ?", user.UserID, employeeSessionAction)
	if module := strings.TrimSpace(c.Query("module")); module != "" {
		query = query.Where("module = ?", module)
	}
	if action := strings.TrimSpace(c.Query("action")); action != "" {
		query = query.Where("action_type = ?", action)
	}
	if from := strings.TrimSpace(c.Query("from")); from != "" {
		value, parseErr := time.ParseInLocation("2006-01-02", from, accountHistoryLocation)
		if parseErr != nil {
			return employeeAccountError(c, fiber.NewError(fiber.StatusBadRequest, "วันที่เริ่มต้นไม่ถูกต้อง"))
		}
		query = query.Where("created_at >= ?", value)
	}
	if to := strings.TrimSpace(c.Query("to")); to != "" {
		value, parseErr := time.ParseInLocation("2006-01-02", to, accountHistoryLocation)
		if parseErr != nil {
			return employeeAccountError(c, fiber.NewError(fiber.StatusBadRequest, "วันที่สิ้นสุดไม่ถูกต้อง"))
		}
		query = query.Where("created_at < ?", value.AddDate(0, 0, 1))
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return employeeAccountError(c, err)
	}
	rows := make([]models.EmpActivityLogs, 0)
	if err := query.Order("created_at DESC, emp_log_id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error; err != nil {
		return employeeAccountError(c, err)
	}
	for i := range rows {
		rows[i].CreatedAt = thailandWallTime(rows[i].CreatedAt)
	}
	return c.JSON(fiber.Map{"data": rows, "page": page, "page_size": pageSize, "total": total})
}

func employeeActivityPositiveInt(value string, fallback int) (int, error) {
	if strings.TrimSpace(value) == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return 0, fiber.NewError(fiber.StatusBadRequest, "ข้อมูลการแบ่งหน้าไม่ถูกต้อง")
	}
	return parsed, nil
}

func employeeAccountError(c *fiber.Ctx, err error) error {
	var fiberError *fiber.Error
	if errors.As(err, &fiberError) {
		return c.Status(fiberError.Code).JSON(fiber.Map{"error": fiberError.Message})
	}
	var postgresError *pgconn.PgError
	if errors.As(err, &postgresError) && postgresError.Code == "23505" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "อีเมลนี้มีอยู่ในระบบแล้ว"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถอ่านหรือบันทึกข้อมูลบัญชีได้"})
}
