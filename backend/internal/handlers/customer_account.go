package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"backend/internal/mailer"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	customerSessionCookie = "octavia_customer_session"
	customerSessionTTL    = 7 * 24 * time.Hour
	customerSessionAction = "AUTH_SESSION"
)

type customerAccountHandler struct {
	db      *gorm.DB
	mailer  mailer.Mailer
	baseURL string
}

type customerAccountDTO struct {
	UserID      string `json:"user_id"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"`
	Gender      string `json:"gender"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	Email       string `json:"email"`
}

type customerRegisterInput struct {
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"`
	Gender      string `json:"gender"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

type customerLoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type customerProfileInput struct {
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	DateOfBirth string `json:"date_of_birth"`
	Gender      string `json:"gender"`
	Phone       string `json:"phone"`
	Address     string `json:"address"`
	Email       string `json:"email"`
}

type customerPasswordInput struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func RegisterCustomerAccountRoutes(app *fiber.App, db *gorm.DB) {
	registerCustomerAccountRoutes(app, db, mailer.FromEnv(), appBaseURL())
}

// registerCustomerAccountRoutes แยกออกมาเพื่อให้เทสต์ฉีด mailer ปลอมเข้ามาได้
func registerCustomerAccountRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer, baseURL string) {
	h := &customerAccountHandler{db: db, mailer: sender, baseURL: baseURL}
	group := app.Group("/api/customer")
	group.Post("/auth/register", h.register)
	group.Post("/auth/login", h.login)
	group.Post("/auth/logout", h.logout)
	group.Post("/auth/forgot-password", h.forgotPassword)
	group.Post("/auth/reset-password", h.resetPassword)
	group.Post("/auth/password-recovery", h.recoverPasswordWithPhone)
	group.Get("/promotions", h.listCustomerPromotions)
	group.Get("/promotions/redeem", h.redeemCustomerPromotion)
	group.Get("/promotions/:id", h.getCustomerPromotion)
	group.Get("/concerts", h.listCustomerConcerts)
	group.Get("/concerts/:id", h.getCustomerConcert)
	group.Get("/account", h.requireCustomer, h.getAccount)
	group.Patch("/account/profile", h.requireCustomer, h.updateProfile)
	group.Patch("/account/password", h.requireCustomer, h.changePassword)
	group.Get("/account/tickets", h.requireCustomer, h.listTickets)
	group.Get("/account/purchases", h.requireCustomer, h.listPurchases)
}

func customerAccountView(user models.User) customerAccountDTO {
	dateOfBirth := ""
	if !user.DateOfBirth.IsZero() {
		dateOfBirth = user.DateOfBirth.Format("2006-01-02")
	}
	return customerAccountDTO{
		UserID: user.UserID, FirstName: user.FirstName, LastName: user.LastName,
		DateOfBirth: dateOfBirth, Gender: user.Gender, Phone: user.PhoneNumber,
		Address: user.Address, Email: user.Email,
	}
}

func normalizeCustomerEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email || len(email) > 255 {
		return "", errors.New("รูปแบบอีเมลไม่ถูกต้อง")
	}
	return email, nil
}

func validateCustomerProfile(input customerProfileInput) (customerProfileInput, time.Time, error) {
	input.FirstName = strings.TrimSpace(input.FirstName)
	input.LastName = strings.TrimSpace(input.LastName)
	input.Phone = strings.TrimSpace(input.Phone)
	input.Gender = strings.TrimSpace(input.Gender)
	input.Address = strings.TrimSpace(input.Address)
	if input.FirstName == "" || input.LastName == "" || input.Phone == "" || input.Gender == "" {
		return input, time.Time{}, errors.New("กรุณากรอกข้อมูลที่จำเป็นให้ครบ")
	}
	email, err := normalizeCustomerEmail(input.Email)
	if err != nil {
		return input, time.Time{}, err
	}
	input.Email = email
	birthDate, err := time.Parse("2006-01-02", strings.TrimSpace(input.DateOfBirth))
	if err != nil || birthDate.After(time.Now()) {
		return input, time.Time{}, errors.New("วันเกิดไม่ถูกต้อง")
	}
	return input, birthDate, nil
}

func (h *customerAccountHandler) register(c *fiber.Ctx) error {
	var input customerRegisterInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "ข้อมูลสมัครสมาชิกไม่ถูกต้อง")
	}
	profile, birthDate, err := validateCustomerProfile(customerProfileInput{
		FirstName: input.FirstName, LastName: input.LastName, DateOfBirth: input.DateOfBirth,
		Gender: input.Gender, Phone: input.Phone, Address: input.Address, Email: input.Email,
	})
	if err != nil {
		return customerError(c, fiber.StatusBadRequest, err.Error())
	}
	if len(input.Password) < 8 {
		return customerError(c, fiber.StatusBadRequest, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถสร้างบัญชีได้")
	}

	user := models.User{
		UserID: "US" + uuid.NewString(), FirstName: profile.FirstName, LastName: profile.LastName,
		DateOfBirth: birthDate, Gender: profile.Gender, PhoneNumber: profile.Phone,
		Address: profile.Address, Email: profile.Email, PasswordHash: string(hash),
		UserType: "customer", Role: "customer",
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.User{}).Where("LOWER(email) = ?", profile.Email).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return gorm.ErrDuplicatedKey
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return tx.Create(&models.CusActivityLogs{UserID: user.UserID, ActionType: "สมัครสมาชิก", Description: "สร้างบัญชีลูกค้า", TargetID: user.UserID}).Error
	}); err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return customerError(c, fiber.StatusConflict, "อีเมลนี้ถูกใช้งานแล้ว")
		}
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถสร้างบัญชีได้")
	}
	if err := h.startSession(c, user.UserID); err != nil {
		return customerError(c, fiber.StatusInternalServerError, "สร้างบัญชีแล้ว แต่ไม่สามารถเข้าสู่ระบบได้")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": customerAccountView(user)})
}

func (h *customerAccountHandler) login(c *fiber.Ctx) error {
	var input customerLoginInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง")
	}
	email, err := normalizeCustomerEmail(input.Email)
	if err != nil || input.Password == "" {
		return customerError(c, fiber.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
	}
	var user models.User
	err = h.db.Where("LOWER(email) = ? AND LOWER(user_type) IN ?", email, []string{"customer", "user", "ลูกค้า"}).First(&user).Error
	if err != nil || user.PasswordHash == "" || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)) != nil {
		return customerError(c, fiber.StatusUnauthorized, "อีเมลหรือรหัสผ่านไม่ถูกต้อง")
	}
	if err := h.startSession(c, user.UserID); err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถเข้าสู่ระบบได้")
	}
	_ = h.db.Create(&models.CusActivityLogs{UserID: user.UserID, ActionType: "เข้าสู่ระบบ", Description: "ลูกค้าเข้าสู่ระบบ", TargetID: user.UserID}).Error
	return c.JSON(fiber.Map{"data": customerAccountView(user)})
}

func (h *customerAccountHandler) logout(c *fiber.Ctx) error {
	if token := c.Cookies(customerSessionCookie); token != "" {
		_ = h.db.Where("action_type = ? AND target_id = ?", customerSessionAction, hashCustomerSessionToken(token)).Delete(&models.CusActivityLogs{}).Error
	}
	clearCustomerSessionCookie(c)
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *customerAccountHandler) startSession(c *fiber.Ctx, userID string) error {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return err
	}
	token := hex.EncodeToString(tokenBytes)
	now := time.Now().UTC()
	expiresAt := now.Add(customerSessionTTL)
	session := models.CusActivityLogs{
		CusLogID: "CL" + uuid.NewString(), UserID: userID, ActionType: customerSessionAction,
		TargetID: hashCustomerSessionToken(token), Description: strconv.FormatInt(expiresAt.Unix(), 10), CreatedAt: now,
	}
	if err := h.db.Create(&session).Error; err != nil {
		return err
	}
	_ = h.db.Where("action_type = ? AND description ~ '^[0-9]+$' AND CAST(description AS BIGINT) < ?", customerSessionAction, now.Unix()).Delete(&models.CusActivityLogs{}).Error
	c.Cookie(&fiber.Cookie{
		Name: customerSessionCookie, Value: token, Path: "/", HTTPOnly: true,
		SameSite: "Lax", Secure: c.Protocol() == "https", Expires: expiresAt,
	})
	return nil
}

func hashCustomerSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	// Raw URL-safe base64 is 43 characters, so the hash fits the existing
	// cus_activity_logs.target_id varchar(50) column.
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func clearCustomerSessionCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{Name: customerSessionCookie, Value: "", Path: "/", HTTPOnly: true, SameSite: "Lax", Expires: time.Unix(0, 0), MaxAge: -1})
}

func (h *customerAccountHandler) requireCustomer(c *fiber.Ctx) error {
	token := c.Cookies(customerSessionCookie)
	if token == "" {
		return customerError(c, fiber.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
	}
	var session models.CusActivityLogs
	if err := h.db.Where("action_type = ? AND target_id = ?", customerSessionAction, hashCustomerSessionToken(token)).First(&session).Error; err != nil {
		clearCustomerSessionCookie(c)
		return customerError(c, fiber.StatusUnauthorized, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
	}
	expiresUnix, err := strconv.ParseInt(session.Description, 10, 64)
	if err != nil || expiresUnix <= time.Now().UTC().Unix() {
		_ = h.db.Delete(&session).Error
		clearCustomerSessionCookie(c)
		return customerError(c, fiber.StatusUnauthorized, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่")
	}
	var user models.User
	if err := h.db.Where("user_id = ? AND LOWER(user_type) IN ?", session.UserID, []string{"customer", "user", "ลูกค้า"}).First(&user).Error; err != nil {
		clearCustomerSessionCookie(c)
		return customerError(c, fiber.StatusUnauthorized, "ไม่พบบัญชีผู้ใช้")
	}
	c.Locals("customerUser", user)
	c.Locals("customerSessionLog", session)
	return c.Next()
}

func currentCustomer(c *fiber.Ctx) models.User {
	return c.Locals("customerUser").(models.User)
}

func (h *customerAccountHandler) getAccount(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"data": customerAccountView(currentCustomer(c))})
}

func (h *customerAccountHandler) updateProfile(c *fiber.Ctx) error {
	var input customerProfileInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "ข้อมูลโปรไฟล์ไม่ถูกต้อง")
	}
	input, birthDate, err := validateCustomerProfile(input)
	if err != nil {
		return customerError(c, fiber.StatusBadRequest, err.Error())
	}
	user := currentCustomer(c)
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "user_id = ?", user.UserID).Error; err != nil {
			return err
		}
		var duplicates int64
		if err := tx.Model(&models.User{}).Where("LOWER(email) = ? AND user_id <> ?", input.Email, user.UserID).Count(&duplicates).Error; err != nil {
			return err
		}
		if duplicates > 0 {
			return gorm.ErrDuplicatedKey
		}
		updates := map[string]any{
			"first_name": input.FirstName, "last_name": input.LastName, "date_of_birth": birthDate,
			"gender": input.Gender, "phone_number": input.Phone, "address": input.Address, "email": input.Email,
		}
		if err := tx.Model(&user).Updates(updates).Error; err != nil {
			return err
		}
		return tx.Create(&models.CusActivityLogs{UserID: user.UserID, ActionType: "แก้ไขโปรไฟล์", Description: "ลูกค้าแก้ไขข้อมูลบัญชี", TargetID: user.UserID}).Error
	})
	if err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return customerError(c, fiber.StatusConflict, "อีเมลนี้ถูกใช้งานแล้ว")
		}
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถบันทึกโปรไฟล์ได้")
	}
	if err := h.db.First(&user, "user_id = ?", user.UserID).Error; err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดโปรไฟล์ได้")
	}
	return c.JSON(fiber.Map{"data": customerAccountView(user)})
}

func (h *customerAccountHandler) changePassword(c *fiber.Ctx) error {
	var input customerPasswordInput
	if err := c.BodyParser(&input); err != nil {
		return customerError(c, fiber.StatusBadRequest, "ข้อมูลรหัสผ่านไม่ถูกต้อง")
	}
	if len(input.NewPassword) < 8 {
		return customerError(c, fiber.StatusBadRequest, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
	}
	user := currentCustomer(c)
	if user.PasswordHash == "" || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.CurrentPassword)) != nil {
		return customerError(c, fiber.StatusBadRequest, "รหัสผ่านปัจจุบันไม่ถูกต้อง")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถเปลี่ยนรหัสผ่านได้")
	}
	session := c.Locals("customerSessionLog").(models.CusActivityLogs)
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).Where("user_id = ?", user.UserID).Update("password_hash", string(hash)).Error; err != nil {
			return err
		}
		if err := tx.Where("user_id = ? AND action_type = ? AND cus_log_id <> ?", user.UserID, customerSessionAction, session.CusLogID).Delete(&models.CusActivityLogs{}).Error; err != nil {
			return err
		}
		return tx.Create(&models.CusActivityLogs{UserID: user.UserID, ActionType: "เปลี่ยนรหัสผ่าน", Description: "ลูกค้าเปลี่ยนรหัสผ่าน", TargetID: user.UserID}).Error
	})
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถเปลี่ยนรหัสผ่านได้")
	}
	return c.SendStatus(fiber.StatusNoContent)
}

type customerTicketDTO struct {
	TicketID    string    `json:"ticket_id"`
	BookingID   string    `json:"booking_id"`
	ConcertID   string    `json:"concert_id"`
	ConcertName string    `json:"concert_name"`
	EventDate   string    `json:"event_date"`
	Location    string    `json:"location"`
	Zone        string    `json:"zone"`
	SeatRow     int       `json:"seat_row"`
	SeatColumn  int       `json:"seat_column"`
	Status      string    `json:"status"`
	PurchasedAt time.Time `json:"purchased_at"`
}

func (h *customerAccountHandler) listTickets(c *fiber.Ctx) error {
	user := currentCustomer(c)
	rows := make([]customerTicketDTO, 0)
	err := h.db.Table("tickets AS t").
		Select(`t.ticket_id, t.booking_id, COALESCE(c.concert_id, '') AS concert_id,
			COALESCE(NULLIF(t.name_concert, ''), c.concert_name, 'คอนเสิร์ต') AS concert_name,
			COALESCE(c.start_date::text, '') AS event_date, COALESCE(c.location, '') AS location,
			COALESCE(z.zone_type, '') AS zone, COALESCE(s.seat_row, 0) AS seat_row,
			COALESCE(s.seat_column, 0) AS seat_column, t.status_ticket AS status,
			t.ticket_date_time AS purchased_at`).
		Joins("JOIN bookings b ON b.booking_id = t.booking_id").
		Joins("LEFT JOIN seats s ON s.seat_id = t.seat_id").
		Joins("LEFT JOIN zones z ON z.zone_id = s.zone_id").
		Joins("LEFT JOIN concerts c ON c.concert_id = s.concert_id").
		Where("b.user_id = ?", user.UserID).
		Order("t.ticket_date_time DESC, t.ticket_id DESC").Scan(&rows).Error
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดบัตรได้")
	}
	return c.JSON(fiber.Map{"data": rows})
}

type customerPurchaseDTO struct {
	BookingID     string    `json:"booking_id"`
	BookingDate   time.Time `json:"booking_date"`
	Status        string    `json:"status"`
	PaymentStatus string    `json:"payment_status"`
	ConcertNames  string    `json:"concert_names"`
	TicketCount   int64     `json:"ticket_count"`
	TotalAmount   float64   `json:"total_amount"`
}

func (h *customerAccountHandler) listPurchases(c *fiber.Ctx) error {
	user := currentCustomer(c)
	rows := make([]customerPurchaseDTO, 0)
	err := h.db.Table("bookings AS b").
		Select(`b.booking_id, b.booking_date, b.status,
			COALESCE((SELECT p.payment_status FROM payments p WHERE p.booking_id = b.booking_id ORDER BY p.payment_id DESC LIMIT 1), '') AS payment_status,
			COALESCE((SELECT STRING_AGG(DISTINCT t.name_concert, ', ') FROM tickets t WHERE t.booking_id = b.booking_id), 'คอนเสิร์ต') AS concert_names,
			(SELECT COUNT(*) FROM tickets t WHERE t.booking_id = b.booking_id) AS ticket_count,
			COALESCE((SELECT SUM(COALESCE((SELECT MAX(tc.price) FROM ticket_categories tc WHERE tc.zone_id = s.zone_id), 0))
				FROM tickets t LEFT JOIN seats s ON s.seat_id = t.seat_id WHERE t.booking_id = b.booking_id), 0) AS total_amount`).
		Where("b.user_id = ?", user.UserID).
		Order("b.booking_date DESC, b.booking_id DESC").Scan(&rows).Error
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดประวัติการซื้อได้")
	}
	return c.JSON(fiber.Map{"data": rows})
}

func customerError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": message})
}
