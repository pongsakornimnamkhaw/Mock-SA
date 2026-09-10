package handlers

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"backend/internal/mailer"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type bookingPaymentHandler struct {
	db     *gorm.DB
	mailer mailer.Mailer
}

// RegisterBookingPaymentRoutes ลงทะเบียน route สำหรับ production ใช้ mailer จริงจาก env
func RegisterBookingPaymentRoutes(app *fiber.App, db *gorm.DB) {
	registerBookingPaymentRoutes(app, db, mailer.FromEnv())
}

// registerBookingPaymentRoutes รับ mailer แยกต่างหากเพื่อให้เทสต์ inject ตัวปลอมได้
func registerBookingPaymentRoutes(app *fiber.App, db *gorm.DB, sender mailer.Mailer) {
	h := &bookingPaymentHandler{db: db, mailer: sender}

	// Customer Booking Endpoints
	app.Post("/api/bookings", h.createBooking)
	app.Get("/api/customer/account/bookings", h.getCustomerBookings)
	app.Post("/api/bookings/:id/reupload-slip", h.reuploadSlip)
	app.Post("/api/bookings/:id/resend-tickets", h.resendTickets)

	// Public / Shared Slip Preview
	app.Get("/api/bookings/:id/slip", h.getSlipImage)

	// Sales Officer Endpoints (B6728786: final document SA.docx U4, UP2, UP3, UP5)
	app.Get("/api/sales/bookings", h.getSalesBookings)
	app.Post("/api/sales/bookings/:id/approve", h.approveBooking)
	app.Post("/api/sales/bookings/:id/reject", h.rejectBooking)
	app.Post("/api/sales/bookings/:id/resend", h.resendTickets)
}

// Request & DTO Structs
type createBookingInput struct {
	ConcertID      string   `json:"concert_id"`
	ConcertTitle   string   `json:"concert_title"`
	EventDate      string   `json:"event_date"`
	Location       string   `json:"location"`
	ZoneID         string   `json:"zone_id"`
	TierName       string   `json:"tier_name"`
	Seats          []string `json:"seats"`
	Quantity       int      `json:"quantity"`
	UnitPrice      float64  `json:"unit_price"`
	DiscountAmount float64  `json:"discount_amount"`
	TotalPrice     float64  `json:"total_price"`
	CustomerName   string   `json:"customer_name"`
	CustomerEmail  string   `json:"customer_email"`
	CustomerPhone  string   `json:"customer_phone"`
	UserID         string   `json:"user_id"`
	SlipFileName   string   `json:"slip_file_name"`
	SlipDataURL    string   `json:"slip_data_url"`
}

type rejectBookingInput struct {
	Reason      string `json:"reason"`
	OfficerName string `json:"officer_name"`
}

type approveBookingInput struct {
	OfficerName string `json:"officer_name"`
}

type reuploadSlipInput struct {
	SlipFileName string `json:"slip_file_name"`
	SlipDataURL  string `json:"slip_data_url"`
}

// 1. Create Booking (Customer Flow)
func (h *bookingPaymentHandler) createBooking(c *fiber.Ctx) error {
	var input createBookingInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลการจองไม่ถูกต้อง"})
	}

	if input.CustomerName == "" || input.CustomerEmail == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณากรอกชื่อและอีเมลผู้จอง"})
	}

	// การจองต้องระบุที่นั่งเสมอ — ไม่งั้นจะได้ booking ที่ไม่รู้ว่ากินที่นั่งใบไหน
	if len(input.Seats) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณาเลือกที่นั่งอย่างน้อย 1 ที่"})
	}

	now := time.Now().UTC()
	dateStr := now.Format("20060102")
	randomSuffix := fmt.Sprintf("%04d", rand.Intn(10000))
	bookingID := fmt.Sprintf("BK-%s-%s", dateStr, randomSuffix)

	status := "under_review"
	if input.SlipFileName == "" && input.SlipDataURL == "" {
		status = "pending_payment"
	}

	var userIDPtr *string
	if input.UserID != "" {
		trimmed := strings.TrimSpace(input.UserID)
		userIDPtr = &trimmed
	}

	qty := input.Quantity
	if qty <= 0 {
		qty = len(input.Seats)
		if qty <= 0 {
			qty = 1
		}
	}

	booking := models.Booking{
		BookingID:      bookingID,
		BookingDate:    now,
		Status:         status,
		UserID:         userIDPtr,
		CustomerName:   input.CustomerName,
		CustomerEmail:  input.CustomerEmail,
		CustomerPhone:  input.CustomerPhone,
		ConcertID:      input.ConcertID,
		ConcertTitle:   input.ConcertTitle,
		ZoneID:         input.ZoneID,
		TierName:       input.TierName,
		Quantity:       qty,
		UnitPrice:      input.UnitPrice,
		DiscountAmount: input.DiscountAmount,
		TotalPrice:     input.TotalPrice,
	}

	// เตรียมผังที่นั่งไว้ก่อน (คอนเสิร์ตสาธิตที่ยังไม่มีผังจะได้ผังเริ่มต้น)
	if err := ensureZoneSeats(h.db, input.ConcertID, input.ZoneID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถเตรียมผังที่นั่งได้"})
	}

	var category models.TicketCategory
	_ = h.db.Where("zone_id = ?", input.ZoneID).First(&category).Error

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&booking).Error; err != nil {
			return err
		}

		seats, err := reserveSeats(tx, input.ConcertID, input.ZoneID, input.Seats)
		if err != nil {
			return err
		}

		tickets := make([]models.Ticket, 0, len(seats))
		for i := range seats {
			label := seats[i].Label()
			ticketID := fmt.Sprintf("TK-%s-%s", bookingID, label)
			tickets = append(tickets, models.Ticket{
				TicketID:       ticketID,
				NameConcert:    input.ConcertTitle,
				TicketDateTime: now,
				PriceTicket:    input.UnitPrice,
				StatusTicket:   ticketStatusPending,
				SeatID:         seats[i].SeatID,
				SeatLabel:      label,
				CategoryID:     category.CategoryID,
				BookingID:      bookingID,
				QrCodeData: fmt.Sprintf("OCTAVIA|%s|%s|%s|%s|%s",
					ticketID, input.ConcertTitle, input.ZoneID, label, input.CustomerName),
			})
		}
		if len(tickets) > 0 {
			if err := tx.Create(&tickets).Error; err != nil {
				return err
			}
			booking.Tickets = tickets
		}

		// บันทึกสลิปการโอนเงิน (Payment)
		if input.SlipFileName != "" || input.SlipDataURL != "" {
			paymentID := fmt.Sprintf("PY-%s-%s", dateStr, randomSuffix)
			var fileBytes []byte
			if strings.Contains(input.SlipDataURL, "base64,") {
				parts := strings.Split(input.SlipDataURL, "base64,")
				if len(parts) == 2 {
					decoded, _ := base64.StdEncoding.DecodeString(parts[1])
					fileBytes = decoded
				}
			}

			fileName := input.SlipFileName
			if fileName == "" {
				fileName = "payment_slip.jpg"
			}

			if err := tx.Create(&models.Payment{
				PaymentID:     paymentID,
				EvidenceFile:  fileBytes,
				FileName:      fileName,
				PaymentStatus: "รอตรวจสอบ",
				BookingID:     bookingID,
				CreatedAt:     now,
			}).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		var conflict seatConflictError
		if errors.As(err, &conflict) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":             conflict.Error(),
				"unavailable_seats": conflict.Labels,
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถบันทึกการจองได้: " + err.Error()})
	}

	// Log customer activity
	if userIDPtr != nil {
		_ = h.db.Create(&models.CusActivityLogs{
			CusLogID:    "CL" + uuid.NewString(),
			UserID:      *userIDPtr,
			ActionType:  "จองบัตร",
			Description: fmt.Sprintf("จองบัตรคอนเสิร์ต %s (รหัส %s)", input.ConcertTitle, bookingID),
			TargetID:    bookingID,
			CreatedAt:   now,
		}).Error
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "บันทึกการจองและส่งหลักฐานสำเร็จ",
		"data":    booking,
	})
}

// 2. Get Customer Bookings (Customer Flow)
func (h *bookingPaymentHandler) getCustomerBookings(c *fiber.Ctx) error {
	userID := c.Query("user_id")
	email := c.Query("email")

	query := h.db.Model(&models.Booking{}).Preload("Tickets").Preload("Payments").Order("booking_date DESC")
	if userID != "" {
		query = query.Where("user_id = ? OR customer_email = ?", userID, email)
	} else if email != "" {
		query = query.Where("customer_email = ?", email)
	}

	var bookings []models.Booking
	if err := query.Find(&bookings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดรายการจองได้"})
	}

	return c.JSON(fiber.Map{"data": bookings})
}

// 3. Get Sales Bookings with search & filters (Sales Officer Flow: U4)
func (h *bookingPaymentHandler) getSalesBookings(c *fiber.Ctx) error {
	status := c.Query("status", "all")
	search := strings.TrimSpace(c.Query("q", ""))

	query := h.db.Model(&models.Booking{}).Preload("Tickets").Preload("Payments").Order("booking_date DESC, booking_id DESC")

	if status != "all" && status != "" {
		query = query.Where("status = ?", status)
	}

	if search != "" {
		likePattern := "%" + search + "%"
		query = query.Where(
			"booking_id ILIKE ? OR customer_name ILIKE ? OR customer_phone ILIKE ? OR concert_title ILIKE ?",
			likePattern, likePattern, likePattern, likePattern,
		)
	}

	var bookings []models.Booking
	if err := query.Find(&bookings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดรายการจองสำหรับฝ่ายขายได้"})
	}

	return c.JSON(fiber.Map{"data": bookings})
}

// 4. Approve Booking & Auto-issue E-Tickets with QR Code (UP2 <<include>> UP3)
func (h *bookingPaymentHandler) approveBooking(c *fiber.Ctx) error {
	actorID := optionalEmployeeAuditUserID(c, h.db)
	bookingID := c.Params("id")
	var input approveBookingInput
	_ = c.BodyParser(&input)

	officerName := input.OfficerName
	if officerName == "" {
		officerName = "พงกรศกร อิ่มน้ำขาว (B6728786)"
	}

	var booking models.Booking
	if err := h.db.Where("booking_id = ?", bookingID).First(&booking).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบรายการจองนี้"})
	}

	now := time.Now().UTC()

	// อัปเดตสถานะการจองเป็น issued
	booking.Status = "issued"
	booking.ReviewedBy = officerName
	booking.ReviewedAt = &now
	booking.RejectReason = ""

	if err := h.db.Save(&booking).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถอนุมัติได้"})
	}

	// อัปเดตสถานะ Payment เป็น อนุมัติ
	_ = h.db.Model(&models.Payment{}).Where("booking_id = ?", bookingID).Update("payment_status", "อนุมัติ").Error

	// UP3: ออกบัตร E-Ticket — ตั๋วถูกสร้างไว้ตั้งแต่ตอนจองแล้ว ที่นี่แค่เปลี่ยนสถานะ
	if err := h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Updates(map[string]any{
			"status_ticket":    ticketStatusIssued,
			"ticket_date_time": now,
		}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถออกบัตรได้"})
	}

	// บันทึกประวัติการตรวจสอบลง emp_activity_logs (Audit Trail)
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		ActionType:  "อนุมัติการชำระเงิน",
		UserID:      actorID,
		Module:      "การจอง",
		Description: fmt.Sprintf("อนุมัติการจอง %s และออกบัตรเข้าชม E-Ticket พร้อม QR Code (ผู้ตรวจสอบ: %s)", bookingID, officerName),
		TargetID:    bookingID,
		CreatedAt:   now,
	}).Error

	// โหลดข้อมูลล่าสุดส่งกลับ
	_ = h.db.Preload("Tickets").Preload("Payments").Where("booking_id = ?", bookingID).First(&booking)
	return c.JSON(fiber.Map{
		"message": "อนุมัติการชำระเงินและออกบัตรเข้าชมเรียบร้อยแล้ว",
		"data":    booking,
	})
}

// 5. Reject Booking (UP4)
func (h *bookingPaymentHandler) rejectBooking(c *fiber.Ctx) error {
	actorID := optionalEmployeeAuditUserID(c, h.db)
	bookingID := c.Params("id")
	var input rejectBookingInput
	if err := c.BodyParser(&input); err != nil || input.Reason == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณาระบุเหตุผลในการปฏิเสธ"})
	}

	officerName := input.OfficerName
	if officerName == "" {
		officerName = "พงกรศกร อิ่มน้ำขาว (B6728786)"
	}

	var booking models.Booking
	if err := h.db.Where("booking_id = ?", bookingID).First(&booking).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบรายการจองนี้"})
	}

	now := time.Now().UTC()
	booking.Status = "rejected"
	booking.RejectReason = input.Reason
	booking.ReviewedBy = officerName
	booking.ReviewedAt = &now

	if err := h.db.Save(&booking).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถบันทึกการปฏิเสธได้"})
	}

	_ = h.db.Model(&models.Payment{}).Where("booking_id = ?", bookingID).Update("payment_status", "ปฏิเสธ").Error

	// คืนที่นั่งให้ลูกค้าคนอื่นจองต่อได้ และยกเลิกตั๋วของการจองนี้
	var seatIDs []string
	if err := h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Pluck("seat_id", &seatIDs).Error; err == nil && len(seatIDs) > 0 {
		_ = h.db.Model(&models.Seat{}).Where("seat_id IN ?", seatIDs).
			Update("status_seat", seatStatusAvailable).Error
	}
	_ = h.db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).
		Update("status_ticket", ticketStatusCancelled).Error

	// บันทึก Audit Log
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		ActionType:  "ปฏิเสธการชำระเงิน",
		UserID:      actorID,
		Module:      "การจอง",
		Description: fmt.Sprintf("ปฏิเสธการจอง %s เหตุผล: %s (ผู้ตรวจสอบ: %s)", bookingID, input.Reason, officerName),
		TargetID:    bookingID,
		CreatedAt:   now,
	}).Error

	_ = h.db.Preload("Tickets").Preload("Payments").Where("booking_id = ?", bookingID).First(&booking)
	return c.JSON(fiber.Map{
		"message": "บันทึกการปฏิเสธการชำระเงินเรียบร้อยแล้ว",
		"data":    booking,
	})
}

// 6. Re-upload Payment Slip (UP4)
func (h *bookingPaymentHandler) reuploadSlip(c *fiber.Ctx) error {
	bookingID := c.Params("id")
	var input reuploadSlipInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลสลิปไม่ถูกต้อง"})
	}

	var booking models.Booking
	if err := h.db.Where("booking_id = ?", bookingID).First(&booking).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบรายการจองนี้"})
	}

	now := time.Now().UTC()
	booking.Status = "under_review"
	booking.RejectReason = ""
	_ = h.db.Save(&booking)

	var fileBytes []byte
	if strings.Contains(input.SlipDataURL, "base64,") {
		parts := strings.Split(input.SlipDataURL, "base64,")
		if len(parts) == 2 {
			decoded, _ := base64.StdEncoding.DecodeString(parts[1])
			fileBytes = decoded
		}
	}

	fileName := input.SlipFileName
	if fileName == "" {
		fileName = "reuploaded_slip.jpg"
	}

	// อัปเดตหรือเพิ่ม Payment ใหม่
	payment := models.Payment{
		PaymentID:     fmt.Sprintf("PY-%s-%04d", now.Format("20060102"), rand.Intn(10000)),
		EvidenceFile:  fileBytes,
		FileName:      fileName,
		PaymentStatus: "รอตรวจสอบ",
		BookingID:     bookingID,
		CreatedAt:     now,
	}
	_ = h.db.Create(&payment).Error

	_ = h.db.Preload("Tickets").Preload("Payments").Where("booking_id = ?", bookingID).First(&booking)
	return c.JSON(fiber.Map{
		"message": "อัปโหลดสลิปใหม่เรียบร้อยแล้ว สถานะเปลี่ยนเป็นรอตรวจสอบ",
		"data":    booking,
	})
}

// 7. Resend Ticket via Email with identical QR code (UP5)
func (h *bookingPaymentHandler) resendTickets(c *fiber.Ctx) error {
	var actorID *string
	if c.Route().Path == "/api/sales/bookings/:id/resend" {
		actorID = optionalEmployeeAuditUserID(c, h.db)
	}
	bookingID := c.Params("id")
	var booking models.Booking
	if err := h.db.Preload("Tickets").Where("booking_id = ?", bookingID).First(&booking).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบรายการจอง"})
	}

	if booking.Status != "issued" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ไม่สามารถส่งบัตรได้เนื่องจากยังไม่อนุมัติการออกบัตร"})
	}

	subject, body := buildTicketResendEmail(booking)
	if err := h.mailer.Send(booking.CustomerEmail, subject, body); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถส่งอีเมลได้"})
	}

	// บันทึกกิจกรรมขอส่งบัตรซ้ำ
	_ = h.db.Create(&models.EmpActivityLogs{
		EmpLogID:    "EL" + uuid.NewString(),
		ActionType:  "ขอส่งบัตรซ้ำ",
		UserID:      actorID,
		Module:      "การจอง",
		Description: fmt.Sprintf("ส่งบัตร E-Ticket ซ้ำทางอีเมล (%s) สำหรับการจอง %s", booking.CustomerEmail, bookingID),
		TargetID:    bookingID,
		CreatedAt:   time.Now().UTC(),
	}).Error

	return c.JSON(fiber.Map{
		"message": fmt.Sprintf("ส่งบัตรเข้าชมซ้ำไปยังอีเมล %s สำเร็จ (ใช้รหัสและ QR Code เดิม)", booking.CustomerEmail),
		"data":    booking.Tickets,
	})
}

// buildTicketResendEmail สร้างหัวข้อ+เนื้อหาอีเมลส่งบัตรซ้ำ จากข้อมูลจริงใน Booking/Ticket
// ไม่แนบรูปภาพ/QR Code (ต้องมี library เพิ่มซึ่งนอกขอบเขต) — บอกให้เข้าเว็บไปดู QR Code ที่หน้า "บัตรของฉัน" แทน
func buildTicketResendEmail(booking models.Booking) (string, string) {
	subject := fmt.Sprintf("บัตรเข้าชม %s (ส่งซ้ำ)", booking.ConcertTitle)
	lines := []string{
		fmt.Sprintf("นี่คือบัตรเข้าชม %s ของคุณ (รหัสการจอง %s)", booking.ConcertTitle, booking.BookingID),
		"",
		"รายการบัตร:",
	}
	for _, ticket := range booking.Tickets {
		lines = append(lines, fmt.Sprintf("- ที่นั่ง %s (รหัสตั๋ว %s)", ticket.SeatLabel, ticket.TicketID))
	}
	lines = append(lines,
		"",
		"เข้าสู่ระบบแล้วไปที่หน้า \"บัตรของฉัน\" เพื่อดู QR Code สำหรับสแกนเข้างาน",
	)
	return subject, strings.Join(lines, "\r\n")
}

// 8. Serve Slip Image
func (h *bookingPaymentHandler) getSlipImage(c *fiber.Ctx) error {
	bookingID := c.Params("id")
	var payment models.Payment
	err := h.db.Where("booking_id = ?", bookingID).Order("created_at DESC").First(&payment).Error
	if err != nil || len(payment.EvidenceFile) == 0 {
		// Return placeholder SVG
		svg := `<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
			<rect width="100%" height="100%" fill="#f1f5f9"/>
			<text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#64748b">หลักฐานการโอนเงิน (Slip)</text>
			<text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#94a3b8">รหัสการจอง: ` + bookingID + `</text>
		</svg>`
		c.Set("Content-Type", "image/svg+xml; charset=utf-8")
		return c.SendString(svg)
	}

	c.Set("Content-Type", "image/jpeg")
	return c.SendStream(bytes.NewReader(payment.EvidenceFile))
}
