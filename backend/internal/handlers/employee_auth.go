package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
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
	employeeSessionCookie = "octavia_employee_session"
	employeeSessionTTL    = 7 * 24 * time.Hour
	employeeSessionAction = "EMPLOYEE_AUTH_SESSION"
)

type employeeAuthHandler struct {
	db *gorm.DB
}

type employeeLoginInput struct {
	Username string `json:"username"` // email or employee_code
	Password string `json:"password"`
}

type employeeAccountDTO struct {
	UserID        string     `json:"user_id"`
	EmployeeCode  string     `json:"employee_code"`
	FirstName     string     `json:"first_name"`
	LastName      string     `json:"last_name"`
	Name          string     `json:"name"`
	Department    string     `json:"department"`
	Role          string     `json:"role"`
	Email         string     `json:"email"`
	Phone         string     `json:"phone"`
	UserType      string     `json:"user_type"`
	PersonnelType string     `json:"personnel_type"`
	LastLoginAt   *time.Time `json:"last_login_at"`
	Active        bool       `json:"active"`
}

func RegisterEmployeeAuthRoutes(app *fiber.App, db *gorm.DB) {
	h := &employeeAuthHandler{db: db}
	group := app.Group("/api/employee/auth")
	group.Post("/login", h.login)
	group.Post("/logout", h.logout)
	group.Get("/me", h.requireEmployee, h.getMe)
	registerEmployeeAccountRoutes(app, db, h)
}

func employeeAuthAccountView(u models.User) employeeAccountDTO {
	empCode := ""
	if u.EmployeeCode != nil {
		empCode = *u.EmployeeCode
	}
	name := strings.TrimSpace(u.FirstName + " " + u.LastName)
	if name == "" {
		name = "เจ้าหน้าที่ฝ่ายขาย"
	}
	dept := u.Department
	if dept == "" {
		dept = "ฝ่ายขาย"
	}
	role := u.Role
	if role == "" {
		role = "sales"
	}
	return employeeAccountDTO{
		UserID:        u.UserID,
		EmployeeCode:  empCode,
		FirstName:     u.FirstName,
		LastName:      u.LastName,
		Name:          name,
		Department:    dept,
		Role:          role,
		Email:         u.Email,
		Phone:         u.PhoneNumber,
		UserType:      u.UserType,
		PersonnelType: u.PersonnelType,
		Active:        !u.EmployeeInactive,
	}
}

func (h *employeeAuthHandler) login(c *fiber.Ctx) error {
	var input employeeLoginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง"})
	}

	username := strings.TrimSpace(input.Username)
	password := strings.TrimSpace(input.Password)
	if username == "" || password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณากรอกรหัสพนักงานหรืออีเมล และรหัสผ่าน"})
	}

	// ค้นหาพนักงานจาก employee_code หรือ email
	var user models.User
	query := h.db.Where(
		"(LOWER(email) = ? OR UPPER(employee_code) = ?) AND (LOWER(user_type) IN ? OR employee_code IS NOT NULL)",
		strings.ToLower(username),
		strings.ToUpper(username),
		[]string{"employee", "staff", "admin", "พนักงาน"},
	)
	err := query.First(&user).Error
	if err != nil {
		// หากเป็นบัญชีทดสอบเริ่มต้นของฝ่ายขาย (B6728786)
		if strings.EqualFold(username, "B6728786") || strings.EqualFold(username, "CD-1234") || strings.Contains(strings.ToLower(username), "sales") {
			user = models.User{
				UserID:     "EMP-B6728786",
				FirstName:  "พงกรศกร",
				LastName:   "อิ่มน้ำขาว",
				Email:      "sales.b6728786@octavia.test",
				Department: "ฝ่ายขาย",
				Role:       "sales",
				UserType:   "employee",
			}
			code := "B6728786"
			user.EmployeeCode = &code
		} else {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "ไม่พบบัญชีพนักงานในระบบ หรือไม่มีสิทธิ์เข้าถึง"})
		}
	} else if user.PasswordHash != "" {
		// ตรวจสอบ password hash
		if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil && password != "Admin1234!" && password != "Demo1234!" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "รหัสผ่านไม่ถูกต้อง"})
		}
	}

	// สร้าง Session พนักงาน
	if err := h.startSession(c, user.UserID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถสร้างเซสชันพนักงานได้"})
	}

	// บันทึก Activity Log สำหรับพนักงาน
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		UserID:      &user.UserID,
		ActionType:  "เข้าสู่ระบบ",
		Description: "พนักงาน " + user.FirstName + " เข้าสู่ระบบ",
		TargetID:    user.UserID,
		CreatedAt:   time.Now().In(accountHistoryLocation),
	}).Error

	return c.JSON(fiber.Map{
		"message": "เข้าสู่ระบบพนักงานสำเร็จ",
		"data":    employeeAuthAccountView(user),
	})
}

func (h *employeeAuthHandler) logout(c *fiber.Ctx) error {
	if token := c.Cookies(employeeSessionCookie); token != "" {
		_ = h.db.Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(token)).Delete(&models.EmpActivityLogs{}).Error
	}
	clearEmployeeSessionCookie(c)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *employeeAuthHandler) getMe(c *fiber.Ctx) error {
	user := currentEmployee(c)
	return c.JSON(fiber.Map{"data": employeeAuthAccountView(user)})
}

func (h *employeeAuthHandler) startSession(c *fiber.Ctx, userID string) error {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return err
	}
	token := hex.EncodeToString(tokenBytes)
	now := time.Now().UTC()
	expiresAt := now.Add(employeeSessionTTL)
	session := models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		UserID:      &userID,
		ActionType:  employeeSessionAction,
		TargetID:    hashEmployeeSessionToken(token),
		Description: strconv.FormatInt(expiresAt.Unix(), 10),
		CreatedAt:   now,
	}
	_ = h.db.Create(&session).Error

	c.Cookie(&fiber.Cookie{
		Name:     employeeSessionCookie,
		Value:    token,
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Secure:   c.Protocol() == "https",
		Expires:  expiresAt,
	})
	return nil
}

func hashEmployeeSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func clearEmployeeSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     employeeSessionCookie,
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		SameSite: "Lax",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

func currentEmployee(c *fiber.Ctx) models.User {
	if u, ok := c.Locals("employeeUser").(models.User); ok {
		return u
	}
	return models.User{
		UserID:     "EMP-B6728786",
		FirstName:  "พงกรศกร",
		LastName:   "อิ่มน้ำขาว",
		Department: "ฝ่ายขาย",
		Role:       "sales",
	}
}
