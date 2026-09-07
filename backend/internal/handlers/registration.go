package handlers

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type registrationHandler struct{ db *gorm.DB }

type registrationRequest struct {
	TicketCode string `json:"ticketCode"`
}

type registrationIssueRequest struct {
	TicketCode string `json:"ticketCode"`
	Result     string `json:"result"`
}

type registrationDetailDTO struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

type registrationResultDTO struct {
	Result      string                  `json:"result"`
	Title       string                  `json:"title"`
	Subtitle    string                  `json:"subtitle"`
	TicketCode  string                  `json:"ticketCode"`
	CheckedInAt *time.Time              `json:"checkedInAt,omitempty"`
	Details     []registrationDetailDTO `json:"details"`
}

type registrationContext struct {
	Ticket  models.Ticket
	Seat    models.Seat
	Zone    models.Zone
	Concert models.Concert
	Gate    *models.GateCheckIn
}

func RegisterRegistrationRoutes(app *fiber.App, db *gorm.DB) {
	h := &registrationHandler{db: db}
	routes := app.Group("/api/registration")
	routes.Post("/check-ins", h.checkIn)
	routes.Post("/issues", h.reportIssue)
}

func (h *registrationHandler) checkIn(c *fiber.Ctx) error {
	var payload registrationRequest
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "รูปแบบข้อมูลบัตรไม่ถูกต้อง"})
	}
	ticketID, err := parseTicketCode(payload.TicketCode)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": err.Error()})
	}

	var result registrationResultDTO
	status := fiber.StatusOK
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var ticket models.Ticket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ticket, ticketID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				status = fiber.StatusNotFound
				result = invalidRegistrationResult(payload.TicketCode, "ไม่พบบัตรนี้ในระบบ", "กรุณาตรวจสอบ QR หรือรหัสบัตรอีกครั้ง")
				return nil
			}
			return err
		}

		context, err := loadRegistrationContext(tx, ticket)
		if err != nil {
			return err
		}
		if ticket.GateID != nil || isCheckedInStatus(ticket.StatusTicket) {
			status = fiber.StatusConflict
			result = usedRegistrationResult(context)
			return nil
		}
		if isRejectedTicketStatus(ticket.StatusTicket) {
			status = fiber.StatusConflict
			result = invalidRegistrationResult(formatTicketCode(ticket.TicketID), "บัตรนี้ไม่สามารถใช้งานได้", "สถานะบัตรไม่อนุญาตให้ลงทะเบียนเข้างาน")
			result.Details = registrationDetails(context)
			return nil
		}

		checkedInAt := time.Now().UTC()
		gate := models.GateCheckIn{GateID: "GC" + uuid.NewString(), GateDateTime: checkedInAt}
		if err := tx.Create(&gate).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.Ticket{}).Where("ticket_id = ?", ticket.TicketID).Updates(map[string]any{
			"gate_id": gate.GateID, "status_ticket": "checked_in",
		}).Error; err != nil {
			return err
		}
		context.Ticket.GateID = &gate.GateID
		context.Ticket.StatusTicket = "checked_in"
		context.Gate = &gate
		result = successRegistrationResult(context)
		return nil
	})
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "ลงทะเบียนบัตรไม่สำเร็จ", err)
	}
	return c.Status(status).JSON(result)
}

func (h *registrationHandler) reportIssue(c *fiber.Ctx) error {
	var payload registrationIssueRequest
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "รูปแบบข้อมูลไม่ถูกต้อง"})
	}
	payload.TicketCode = strings.TrimSpace(payload.TicketCode)
	payload.Result = strings.ToLower(strings.TrimSpace(payload.Result))
	if payload.TicketCode == "" || len(payload.TicketCode) > 50 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "กรุณาระบุรหัสบัตร"})
	}
	if payload.Result != "used" && payload.Result != "invalid" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "แจ้งผู้จัดการได้เฉพาะบัตรที่ใช้แล้วหรือไม่ถูกต้อง"})
	}
	description := fmt.Sprintf("แจ้งปัญหาจากจุดลงทะเบียน: บัตร %s ผลตรวจ %s", payload.TicketCode, payload.Result)
	log := models.EmpActivityLogs{
		EmpLogID: "EL" + uuid.NewString(), ActionType: "REPORT_CHECK_IN_ISSUE",
		TargetID: payload.TicketCode, Description: description, CreatedAt: time.Now().UTC(),
	}
	if err := h.db.Create(&log).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "แจ้งผู้จัดการไม่สำเร็จ", err)
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "แจ้งผู้จัดการเรียบร้อยแล้ว", "logId": log.EmpLogID})
}

func loadRegistrationContext(tx *gorm.DB, ticket models.Ticket) (registrationContext, error) {
	result := registrationContext{Ticket: ticket}
	if err := tx.First(&result.Seat, "seat_id = ?", ticket.SeatID).Error; err != nil {
		return result, fmt.Errorf("load ticket seat: %w", err)
	}
	if err := tx.First(&result.Zone, "zone_id = ?", result.Seat.ZoneID).Error; err != nil {
		return result, fmt.Errorf("load ticket zone: %w", err)
	}
	if err := tx.First(&result.Concert, "concert_id = ?", result.Seat.ConcertID).Error; err != nil {
		return result, fmt.Errorf("load ticket concert: %w", err)
	}
	if ticket.GateID != nil {
		var gate models.GateCheckIn
		if err := tx.First(&gate, "gate_id = ?", *ticket.GateID).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return result, fmt.Errorf("load check-in: %w", err)
		} else if err == nil {
			result.Gate = &gate
		}
	}
	return result, nil
}

func successRegistrationResult(context registrationContext) registrationResultDTO {
	checkedInAt := context.Gate.GateDateTime
	return registrationResultDTO{
		Result: "success", Title: "ลงทะเบียนสำเร็จ", Subtitle: "เช็คอินเรียบร้อย · ยินดีต้อนรับเข้าสู่งาน",
		TicketCode: formatTicketCode(context.Ticket.TicketID), CheckedInAt: &checkedInAt,
		Details: registrationDetails(context),
	}
}

func usedRegistrationResult(context registrationContext) registrationResultDTO {
	result := registrationResultDTO{
		Result: "used", Title: "บัตรนี้ถูกใช้ไปแล้ว", Subtitle: "พบบันทึกการเช็คอินก่อนหน้า",
		TicketCode: formatTicketCode(context.Ticket.TicketID), Details: registrationDetails(context),
	}
	if context.Gate != nil {
		checkedInAt := context.Gate.GateDateTime
		result.CheckedInAt = &checkedInAt
		result.Subtitle = "เช็คอินเมื่อ " + checkedInAt.Format("02/01/2006 15:04") + " น."
	}
	return result
}

func invalidRegistrationResult(ticketCode, title, subtitle string) registrationResultDTO {
	return registrationResultDTO{
		Result: "invalid", Title: title, Subtitle: subtitle, TicketCode: strings.TrimSpace(ticketCode),
		Details: []registrationDetailDTO{
			{Label: "รหัสที่สแกน", Value: strings.TrimSpace(ticketCode)},
			{Label: "สถานะ", Value: "ไม่ผ่านการตรวจสอบ"},
		},
	}
}

func registrationDetails(context registrationContext) []registrationDetailDTO {
	booking := "ไม่ระบุ"
	if context.Ticket.BookingID != nil && strings.TrimSpace(*context.Ticket.BookingID) != "" {
		booking = *context.Ticket.BookingID
	}
	zone := context.Zone.ZoneName
	if strings.TrimSpace(zone) == "" {
		zone = context.Zone.ZoneType
	}
	seatName := strings.TrimSpace(context.Seat.SeatRow + context.Seat.SeatColumn)
	return []registrationDetailDTO{
		{Label: "งานแสดง", Value: context.Concert.ConcertName},
		{Label: "รหัสการจอง", Value: booking},
		{Label: "รหัสบัตร", Value: formatTicketCode(context.Ticket.TicketID)},
		{Label: "โซน / ที่นั่ง", Value: strings.TrimSpace(zone + " · " + seatName)},
	}
}

func parseTicketCode(value string) (uint, error) {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	normalized = strings.TrimPrefix(normalized, "#")
	normalized = strings.TrimPrefix(normalized, "TK-")
	if index := strings.LastIndex(normalized, "-"); index >= 0 {
		normalized = normalized[index+1:]
	}
	if normalized == "" {
		return 0, errors.New("กรุณาระบุรหัสบัตร")
	}
	parsed, err := strconv.ParseUint(normalized, 10, 0)
	if err != nil || parsed == 0 {
		return 0, errors.New("รหัสบัตรต้องเป็นตัวเลข หรืออยู่ในรูปแบบ TK-000001")
	}
	return uint(parsed), nil
}

func formatTicketCode(ticketID uint) string {
	return fmt.Sprintf("TK-%06d", ticketID)
}

func isCheckedInStatus(value string) bool {
	status := strings.ToLower(strings.TrimSpace(value))
	return status == "checked_in" || status == "checked-in" || status == "used"
}

func isRejectedTicketStatus(value string) bool {
	status := strings.ToLower(strings.TrimSpace(value))
	return status == "cancelled" || status == "canceled" || status == "disabled" || status == "inactive"
}
