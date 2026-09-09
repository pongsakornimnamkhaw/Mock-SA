package handlers

import (
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const employeePermissionPosition = "employee_management"

type employeeDTO struct {
	EmployeeID   string `json:"employee_id"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name"`
	EmployeeCode string `json:"employee_code"`
	Department   string `json:"department"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Permission   string `json:"permission"`
	EditScope    string `json:"edit_scope,omitempty"`
}

func employeeQuery(db *gorm.DB) *gorm.DB {
	return db.Model(&models.User{}).Where("user_type IN ? AND employee_inactive = ?", []string{"employee", "staff", "พนักงาน"}, false)
}

func employeeView(u models.User) employeeDTO {
	e := employeeDTO{EmployeeID: u.UserID, FirstName: u.FirstName, LastName: u.LastName, Department: u.Department, Email: u.Email, Phone: u.PhoneNumber, Permission: u.Role}
	if u.EmployeeCode != nil {
		e.EmployeeCode = *u.EmployeeCode
	}
	if e.Permission != "admin" && e.Permission != "edit" {
		e.Permission = "view_only"
	}
	for _, p := range u.Permissions {
		if p.Position == employeePermissionPosition {
			e.Permission = p.PermissionName
			if p.PermissionName == "edit" {
				e.EditScope = p.Scope
			}
			break
		}
	}
	return e
}

func (h *managementHandler) listEmployees(c *fiber.Ctx) error {
	users := []models.User{}
	if err := employeeQuery(h.db).Preload("Permissions").Order("first_name, user_id").Find(&users).Error; err != nil {
		return managementError(c, err)
	}
	rows := make([]employeeDTO, 0, len(users))
	admins := 0
	for _, u := range users {
		e := employeeView(u)
		rows = append(rows, e)
		if e.Permission == "admin" {
			admins++
		}
	}
	var customers int64
	if err := h.db.Model(&models.User{}).Where("user_type IN ?", []string{"customer", "user", "ลูกค้า"}).Count(&customers).Error; err != nil {
		return managementError(c, err)
	}
	return c.JSON(fiber.Map{"data": rows, "summary": fiber.Map{"employee_count": len(rows), "admin_count": admins, "customer_count": customers}})
}

func (h *managementHandler) getEmployee(c *fiber.Ctx) error {
	var u models.User
	if err := employeeQuery(h.db).Preload("Permissions").First(&u, "user_id = ?", c.Params("id")).Error; err != nil {
		return managementError(c, err)
	}
	return c.JSON(employeeView(u))
}

var employeePhonePattern = regexp.MustCompile(`^[0-9+() -]{8,20}$`)

func validateEmployee(e *employeeDTO) error {
	e.FirstName = strings.TrimSpace(e.FirstName)
	e.LastName = strings.TrimSpace(e.LastName)
	e.EmployeeCode = strings.TrimSpace(e.EmployeeCode)
	e.Department = strings.TrimSpace(e.Department)
	e.Email = strings.ToLower(strings.TrimSpace(e.Email))
	e.Phone = strings.TrimSpace(e.Phone)
	if e.FirstName == "" || e.LastName == "" || e.EmployeeCode == "" || e.Email == "" || e.Phone == "" {
		return fiber.NewError(400, "กรุณากรอกชื่อ นามสกุล รหัสพนักงาน อีเมล และเบอร์โทร")
	}
	if utf8.RuneCountInString(e.FirstName) > 100 || utf8.RuneCountInString(e.LastName) > 100 || utf8.RuneCountInString(e.EmployeeCode) > 50 || utf8.RuneCountInString(e.Department) > 100 || len(e.Email) > 255 {
		return fiber.NewError(400, "ข้อมูลยาวเกินกำหนด")
	}
	address, err := mail.ParseAddress(e.Email)
	if err != nil || address.Address != e.Email || !employeePhonePattern.MatchString(e.Phone) {
		return fiber.NewError(400, "รูปแบบอีเมลหรือเบอร์โทรไม่ถูกต้อง")
	}
	digits := 0
	for _, char := range e.Phone {
		if char >= '0' && char <= '9' {
			digits++
		}
	}
	if digits < 9 || digits > 15 {
		return fiber.NewError(400, "กรุณากรอกเบอร์โทร 9–15 หลัก")
	}
	if e.Permission != "view_only" && e.Permission != "edit" && e.Permission != "admin" {
		return fiber.NewError(400, "สิทธิ์พนักงานไม่ถูกต้อง")
	}
	if e.Permission == "edit" {
		if e.EditScope != "all" && e.EditScope != "promotions" && e.EditScope != "users" {
			return fiber.NewError(400, "กรุณาเลือกขอบเขตการแก้ไข")
		}
	} else {
		e.EditScope = ""
	}
	return nil
}

func employeeAccountActions(previous, input employeeDTO, creating bool) []string {
	if creating {
		return []string{"สร้างบัญชี"}
	}
	actions := make([]string, 0, 2)
	profileChanged := previous.FirstName != input.FirstName ||
		previous.LastName != input.LastName ||
		previous.EmployeeCode != input.EmployeeCode ||
		previous.Department != input.Department ||
		previous.Email != input.Email ||
		previous.Phone != input.Phone
	if profileChanged {
		actions = append(actions, "แก้ไขบัญชี")
	}
	if previous.Permission != input.Permission || previous.EditScope != input.EditScope {
		actions = append(actions, "เปลี่ยนสิทธิ์")
	}
	return actions
}

func (h *managementHandler) saveEmployee(c *fiber.Ctx) error {
	var input employeeDTO
	if err := c.BodyParser(&input); err != nil {
		return managementError(c, fiber.NewError(400, "รูปแบบข้อมูลไม่ถูกต้อง"))
	}
	if err := validateEmployee(&input); err != nil {
		return managementError(c, err)
	}
	id := c.Params("id")
	var result employeeDTO
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var u models.User
		var previous employeeDTO
		if id != "" {
			if err := employeeQuery(tx).Preload("Permissions").Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, "user_id = ?", id).Error; err != nil {
				return err
			}
			previous = employeeView(u)
		} else {
			u.UserID = "US" + uuid.NewString()
			u.UserType = "employee"
		}
		actions := employeeAccountActions(previous, input, id == "")
		// Case-insensitive uniqueness also covers existing mixed-case addresses.
		// The lock serializes this module's writers; DB unique indexes remain the last guard.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", "employee-email:"+input.Email).Error; err != nil {
			return err
		}
		var duplicates int64
		if err := tx.Model(&models.User{}).Where("LOWER(email) = ? AND user_id <> ?", input.Email, u.UserID).Count(&duplicates).Error; err != nil {
			return err
		}
		if duplicates > 0 {
			return fiber.NewError(409, "อีเมลนี้มีอยู่ในระบบแล้ว")
		}
		u.FirstName = input.FirstName
		u.LastName = input.LastName
		u.EmployeeCode = &input.EmployeeCode
		u.Department = input.Department
		u.Email = input.Email
		u.PhoneNumber = input.Phone
		u.Role = input.Permission
		if id == "" {
			if err := tx.Omit(clause.Associations).Create(&u).Error; err != nil {
				return err
			}
		} else {
			// Update only fields owned by this screen, preserving other user information.
			if err := tx.Model(&u).Updates(map[string]interface{}{"first_name": u.FirstName, "last_name": u.LastName, "employee_code": u.EmployeeCode, "department": u.Department, "email": u.Email, "phone_number": u.PhoneNumber, "role": u.Role}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("user_id = ? AND position = ?", u.UserID, employeePermissionPosition).Delete(&models.Permission{}).Error; err != nil {
			return err
		}
		scope := input.EditScope
		if input.Permission == "admin" {
			scope = "all"
		}
		p := models.Permission{PermissionID: "PM" + uuid.NewString(), UserID: u.UserID, Position: employeePermissionPosition, PermissionName: input.Permission, Scope: scope}
		if err := tx.Create(&p).Error; err != nil {
			return err
		}
		for _, action := range actions {
			detail := "สร้างบัญชีพนักงาน " + input.EmployeeCode + " สิทธิ์ " + input.Permission
			if action == "แก้ไขบัญชี" {
				detail = "แก้ไขข้อมูลบัญชีพนักงาน " + input.EmployeeCode
			} else if action == "เปลี่ยนสิทธิ์" {
				detail = "เปลี่ยนสิทธิ์พนักงาน " + input.EmployeeCode + " เป็น " + input.Permission + " ขอบเขต " + scope
			}
			if err := auditManagement(tx, action, u.UserID, detail); err != nil {
				return err
			}
		}
		u.Permissions = []models.Permission{p}
		result = employeeView(u)
		return nil
	})
	if err != nil {
		return managementError(c, err)
	}
	if id == "" {
		c.Status(fiber.StatusCreated)
	}
	return c.JSON(result)
}

func (h *managementHandler) deleteEmployee(c *fiber.Ctx) error {
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var u models.User
		if err := employeeQuery(tx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&u, "user_id = ?", c.Params("id")).Error; err != nil {
			return err
		}
		if err := tx.Model(&u).Update("employee_inactive", true).Error; err != nil {
			return err
		}
		return auditManagement(tx, "ปิดใช้งานบัญชี", u.UserID, "ปิดใช้งานบัญชีพนักงาน "+u.FirstName+" "+u.LastName+" โดยเก็บข้อมูลอ้างอิงและประวัติไว้")
	})
	if err != nil {
		return managementError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
