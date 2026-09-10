package handlers

import (
	"strings"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func employeeTokenFromRequest(c *fiber.Ctx) string {
	if token := c.Cookies(employeeSessionCookie); token != "" {
		return token
	}
	authHeader := c.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	}
	return ""
}

func loadEmployeeFromRequest(c *fiber.Ctx, db *gorm.DB) (models.User, error) {
	token := employeeTokenFromRequest(c)
	if token == "" {
		return models.User{}, fiber.ErrUnauthorized
	}
	var session models.EmpActivityLogs
	if db == nil || db.Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(token)).First(&session).Error != nil {
		return models.User{}, fiber.ErrUnauthorized
	}
	var user models.User
	if session.UserID == nil || db.First(&user, "user_id = ? AND employee_inactive = ?", *session.UserID, false).Error != nil {
		return models.User{}, fiber.ErrUnauthorized
	}
	return user, nil
}

func (h *employeeAuthHandler) requireEmployee(c *fiber.Ctx) error {
	user, err := loadEmployeeFromRequest(c, h.db)
	if err != nil {
		if employeeTokenFromRequest(c) != "" {
			clearEmployeeSessionCookie(c)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "เซสชันพนักงานหมดอายุ กรุณาเข้าสู่ระบบใหม่"})
		}
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "กรุณาเข้าสู่ระบบพนักงาน"})
	}
	c.Locals("employeeUser", user)
	return c.Next()
}

func (h *employeeAuthHandler) requireAdmin(c *fiber.Ctx) error {
	user, err := loadEmployeeFromRequest(c, h.db)
	if err != nil {
		if employeeTokenFromRequest(c) != "" {
			clearEmployeeSessionCookie(c)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "เซสชันพนักงานหมดอายุ กรุณาเข้าสู่ระบบใหม่"})
		}
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "กรุณาเข้าสู่ระบบพนักงาน"})
	}
	if !strings.EqualFold(user.Role, "admin") {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "เฉพาะผู้ดูแลระบบเท่านั้น"})
	}
	c.Locals("employeeUser", user)
	return c.Next()
}
