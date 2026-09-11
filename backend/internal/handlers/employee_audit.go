package handlers

import (
	"strings"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func RegisterEmployeeAuditMiddleware(app *fiber.App, db *gorm.DB) {
	app.Use(EmployeeAuditMiddleware(db))
}

// Auditing is optional: authentication and audit failures must not change the
// existing public mutation APIs. Resolve the actor before the handler can change
// or deactivate the employee's account.
func EmployeeAuditMiddleware(db *gorm.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		action, module, ok := employeeAuditMetadata(c.Method(), c.Path())
		if !ok {
			return c.Next()
		}
		user, authErr := loadEmployeeFromRequest(c, db)
		err := c.Next()
		if authErr != nil || err != nil || c.Response().StatusCode() < 200 || c.Response().StatusCode() >= 300 {
			return err
		}
		target := c.Params("id")
		if target == "" {
			target = c.Params("taskId")
		}
		if target == "" {
			target = c.Params("docId")
		}
		_ = createEmployeeAudit(db, user.UserID, action, module, target)
		return err
	}
}

func createEmployeeAudit(db *gorm.DB, userID, action, module, target string) error {
	return db.Create(&models.EmpActivityLogs{
		UserID: &userID, ActionType: action, Module: module, TargetID: target,
		Description: strings.TrimSpace(action + module + " " + target),
		CreatedAt:   time.Now().In(accountHistoryLocation),
	}).Error
}

func optionalEmployeeAuditUserID(c *fiber.Ctx, db *gorm.DB) *string {
	user, err := loadEmployeeFromRequest(c, db)
	if err != nil {
		return nil
	}
	return &user.UserID
}

// Only explicitly registered employee mutations belong here. Management routes
// (/promotions, /promotion-approvals, /employees) and sales booking decisions
// write richer rows themselves and are deliberately excluded, as are employee
// authentication/account/password-reset and every customer booking/account route.
func employeeAuditMetadata(method, path string) (action, module string, ok bool) {
	switch method {
	case fiber.MethodPost:
		action = "เพิ่ม"
	case fiber.MethodPut, fiber.MethodPatch:
		action = "แก้ไข"
	case fiber.MethodDelete:
		action = "ลบ"
	default:
		return "", "", false
	}
	parts := strings.Split(strings.ToLower(strings.Trim(path, "/")), "/")
	for _, route := range []struct{ methods, pattern, module, action string }{
		{"POST", "api/concerts", "คอนเสิร์ต", ""},
		{"PUT DELETE", "api/concerts/:id", "คอนเสิร์ต", ""},
		{"PUT PATCH", "api/concerts/:id/status", "คอนเสิร์ต", ""},
		{"POST", "api/concerts/:id/tasks", "แผนงาน", ""},
		{"PUT PATCH", "api/tasks/:taskid/status", "แผนงาน", ""},
		{"PUT", "api/concerts/:id/tasks/:taskid/status", "แผนงาน", ""},
		{"POST", "api/concerts/:id/documents", "คอนเสิร์ต", ""},
		{"DELETE", "api/documents/:docid", "คอนเสิร์ต", ""},
		{"POST", "api/artists", "ศิลปิน", ""},
		{"PUT DELETE", "api/artists/:id", "ศิลปิน", ""},
		{"PUT", "api/artists/:id/invitations", "ศิลปิน", ""},
		{"POST", "api/performance-schedules", "ตารางการแสดง", "แก้ไข"},
		{"PUT", "api/concerts/:id/performance-schedules", "ตารางการแสดง", ""},
		{"POST", "api/performance-details", "ตารางการแสดง", ""},
		{"POST", "api/artist-requirements", "ความต้องการศิลปิน", ""},
		{"PUT", "api/work-plans/current", "แผนงาน", ""},
		{"POST", "api/work-plans/current/submit", "แผนงาน", "ส่งแผนงาน"},
	} {
		if !strings.Contains(" "+route.methods+" ", " "+method+" ") {
			continue
		}
		pattern := strings.Split(route.pattern, "/")
		if len(parts) != len(pattern) {
			continue
		}
		matched := true
		for i, segment := range pattern {
			if parts[i] == "" || (!strings.HasPrefix(segment, ":") && segment != parts[i]) {
				matched = false
				break
			}
		}
		if matched {
			if route.action != "" {
				action = route.action
			}
			return action, route.module, true
		}
	}
	return "", "", false
}
