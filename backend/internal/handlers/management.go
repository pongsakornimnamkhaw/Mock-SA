package handlers

import (
	"errors"
	"log"
	"strings"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
)

type managementHandler struct{ db *gorm.DB }

var accountHistoryLocation = time.FixedZone("Asia/Bangkok", 7*60*60)

// Authentication is not implemented by this application yet. Do not trust a
// browser-supplied employee ID or invent an actor for audit/approval records.
const unidentifiedActor = "ไม่ระบุตัวตน (ยังไม่มีระบบเข้าสู่ระบบ)"

func RegisterManagementRoutes(app *fiber.App, db *gorm.DB) {
	h := &managementHandler{db: db}
	r := app.Group("/api")
	r.Get("/promotions/options", h.promotionOptions)
	r.Get("/promotions", h.listPromotions)
	r.Post("/promotions", h.savePromotion)
	r.Get("/promotions/:id", h.getPromotion)
	r.Put("/promotions/:id", h.savePromotion)
	r.Delete("/promotions/:id", h.deletePromotion)
	r.Get("/promotion-approvals", h.listApprovals)
	r.Patch("/promotion-approvals/:id", h.decideApproval)
	r.Get("/employees", h.listEmployees)
	r.Post("/employees", h.saveEmployee)
	r.Get("/employees/:id", h.getEmployee)
	r.Put("/employees/:id", h.saveEmployee)
	r.Delete("/employees/:id", h.deleteEmployee)
	r.Get("/activity-logs", h.listActivityLogs)
}

func managementError(c *fiber.Ctx, err error) error {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		return c.Status(fe.Code).JSON(fiber.Map{"message": fe.Message})
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c.Status(404).JSON(fiber.Map{"message": "ไม่พบข้อมูล"})
	}
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		if pe.Code == "23505" {
			return c.Status(409).JSON(fiber.Map{"message": "อีเมลหรือรหัสซ้ำกับข้อมูลที่มีอยู่"})
		}
		if pe.Code == "23503" {
			return c.Status(409).JSON(fiber.Map{"message": "ข้อมูลที่อ้างอิงไม่มีอยู่หรือถูกใช้งานอยู่"})
		}
	}
	log.Printf("management API: %v", err)
	return c.Status(500).JSON(fiber.Map{"message": "ไม่สามารถบันทึกหรืออ่านข้อมูลจากฐานข้อมูลได้"})
}

func auditManagement(tx *gorm.DB, action, target, detail string) error {
	return tx.Create(&models.EmpActivityLogs{EmpLogID: "EL" + uuid.NewString(), ActionType: action, TargetID: target, Description: detail}).Error
}

var accountActivityLabels = map[string]map[string]string{
	"staff": {
		"สร้างบัญชี":      "สร้างบัญชี",
		"เข้าสู่ระบบ":     "เข้าสู่ระบบ",
		"แก้ไขบัญชี":      "แก้ไขบัญชี",
		"เปลี่ยนสิทธิ์":   "เปลี่ยนสิทธิ์",
		"เปลี่ยนรหัสผ่าน": "เปลี่ยนรหัสผ่าน",
		"รีเซ็ตรหัสผ่าน":  "รีเซ็ตรหัสผ่าน",
		"ปิดใช้งานบัญชี":  "ปิดใช้งานบัญชี",
	},
	"user": {
		"สมัครสมาชิก":     "สร้างบัญชี",
		"เข้าสู่ระบบ":     "เข้าสู่ระบบ",
		"แก้ไขโปรไฟล์":    "แก้ไขบัญชี",
		"เปลี่ยนรหัสผ่าน": "เปลี่ยนรหัสผ่าน",
		"รีเซ็ตรหัสผ่าน":  "รีเซ็ตรหัสผ่าน",
	},
}

var legacyStaffAccountActivityLabels = map[string]string{
	"สร้าง":  "สร้างบัญชี",
	"อัปเดต": "แก้ไขบัญชี",
	"ลบ":     "ปิดใช้งานบัญชี",
}

func accountActivityLabel(kind, action string) (string, bool) {
	labels, ok := accountActivityLabels[kind]
	if !ok {
		return "", false
	}
	label, ok := labels[action]
	if !ok && kind == "staff" {
		label, ok = legacyStaffAccountActivityLabels[action]
	}
	return label, ok
}

func accountActivityActions(kind string) []string {
	labels := accountActivityLabels[kind]
	actions := make([]string, 0, len(labels))
	for action := range labels {
		actions = append(actions, action)
	}
	return actions
}

func thailandWallTime(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), value.Hour(), value.Minute(), value.Second(), value.Nanosecond(), accountHistoryLocation)
}

func (h *managementHandler) listActivityLogs(c *fiber.Ctx) error {
	kind := c.Query("type", "staff")
	if kind != "staff" && kind != "user" {
		return managementError(c, fiber.NewError(400, "ประเภทประวัติไม่ถูกต้อง"))
	}
	scope := c.Query("scope")
	if scope != "" && scope != "account" {
		return managementError(c, fiber.NewError(400, "ขอบเขตประวัติไม่ถูกต้อง"))
	}
	table, id := "emp_activity_logs", "emp_log_id"
	if kind == "user" {
		table, id = "cus_activity_logs", "cus_log_id"
	}
	type row struct {
		LogID        string    `json:"log_id"`
		Date         time.Time `json:"date"`
		UserName     string    `json:"user_name"`
		UserCode     string    `json:"user_code"`
		ActivityType string    `json:"activity_type"`
		ActionCode   string    `json:"action_code"`
		Detail       string    `json:"detail"`
		TargetID     string    `json:"target_id"`
	}
	rows := []row{}
	query := h.db.Table(table+" AS l").Select("l."+id+" AS log_id, l.created_at AS date, COALESCE(NULLIF(TRIM(CONCAT(actor.first_name, ' ', actor.last_name)), ''), NULLIF(TRIM(CONCAT(target.first_name, ' ', target.last_name)), ''), ?) AS user_name, COALESCE(actor.employee_code, actor.user_id, target.employee_code, target.user_id, '—') AS user_code, l.action_type AS activity_type, l.description AS detail, l.target_id", unidentifiedActor).
		Joins("LEFT JOIN users actor ON actor.user_id = l.user_id").
		Joins("LEFT JOIN users target ON target.user_id = l.target_id")
	if scope == "account" && kind == "staff" {
		legacyActions := make([]string, 0, len(legacyStaffAccountActivityLabels))
		for action := range legacyStaffAccountActivityLabels {
			legacyActions = append(legacyActions, action)
		}
		query = query.Where("l.action_type IN ? OR (l.action_type IN ? AND target.user_id IS NOT NULL AND LOWER(target.user_type) IN ?)", accountActivityActions(kind), legacyActions, []string{"employee", "staff", "พนักงาน"})
	} else if scope == "account" {
		query = query.Where("l.action_type IN ?", accountActivityActions(kind))
	} else if kind == "staff" {
		query = query.Where("l.action_type <> ?", employeeSessionAction)
	} else {
		query = query.Where("l.action_type <> ?", customerSessionAction)
	}
	err := query.Order("l.created_at DESC, l." + id + " DESC").Scan(&rows).Error
	if err != nil {
		return managementError(c, err)
	}
	for i := range rows {
		// Audit columns are timestamp-without-time-zone values containing Bangkok
		// wall-clock time. Attach the correct offset before serializing to JSON.
		rows[i].Date = thailandWallTime(rows[i].Date)
		rows[i].ActionCode = rows[i].ActivityType
		if scope == "account" {
			if label, ok := accountActivityLabel(kind, rows[i].ActionCode); ok {
				rows[i].ActivityType = label
			}
			continue
		}
		switch rows[i].ActionCode {
		case "CREATE_PROMOTION":
			rows[i].ActivityType = "สร้าง"
		case "UPDATE_PROMOTION":
			rows[i].ActivityType = "อัปเดต"
		case "DELETE_PROMOTION":
			rows[i].ActivityType = "ลบ"
		case "APPROVE_PROMOTION":
			rows[i].ActivityType = "อนุมัติ"
		case "REJECT_PROMOTION":
			rows[i].ActivityType = "ปฏิเสธ"
		case "DECIDE_PROMOTION":
			rows[i].ActivityType = "พิจารณาโปรโมชั่น"
			if strings.Contains(rows[i].Detail, "ปฏิเสธคำขอ") {
				rows[i].ActivityType = "ปฏิเสธ"
			} else if strings.Contains(rows[i].Detail, "อนุมัติคำขอ") {
				rows[i].ActivityType = "อนุมัติ"
			}
		}
	}
	return c.JSON(fiber.Map{"data": rows})
}
