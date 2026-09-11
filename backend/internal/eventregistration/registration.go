package eventregistration

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errTicketUsed         = errors.New("ticket has already been used")
	errTicketUnavailable  = errors.New("ticket is not ready for check-in")
	errTicketWrongConcert = errors.New("ticket belongs to another concert")
)

type RegistrationHandler struct {
	db *gorm.DB
}

type ticketIDInput uint

func (value *ticketIDInput) UnmarshalJSON(data []byte) error {
	var raw string
	if len(data) > 0 && data[0] == '"' {
		if err := json.Unmarshal(data, &raw); err != nil {
			return err
		}
	} else {
		raw = string(data)
	}
	parsed, err := parseTicketID(raw)
	if err != nil {
		return err
	}
	*value = ticketIDInput(parsed)
	return nil
}

type checkInRequest struct {
	TicketID  ticketIDInput `json:"ticketId"`
	GateID    int           `json:"gateId"`
	ConcertID string        `json:"concertId"`
}

type registrationTicketDTO struct {
	ErrorCode      string     `json:"code,omitempty"`
	ErrorMessage   string     `json:"error,omitempty"`
	TicketID       uint       `json:"ticketId"`
	ConcertID      string     `json:"concertId"`
	ConcertName    string     `json:"concertName"`
	TicketDateTime time.Time  `json:"ticketDateTime"`
	TicketImageURL string     `json:"ticketImageUrl"`
	TicketStatus   string     `json:"ticketStatus"`
	SeatID         uint       `json:"seatId"`
	SeatRow        int        `json:"seatRow"`
	SeatColumn     int        `json:"seatColumn"`
	ZoneID         string     `json:"zoneId"`
	ZoneType       string     `json:"zoneType"`
	CheckedIn      bool       `json:"checkedIn"`
	CheckedInAt    *time.Time `json:"checkedInAt,omitempty"`
	GateID         int        `json:"gateId,omitempty"`
}

type registrationGateDTO struct {
	GateID      int        `json:"gateId"`
	CheckedIn   int64      `json:"checkedIn"`
	Percentage  float64    `json:"percentage"`
	LastCheckIn *time.Time `json:"lastCheckIn,omitempty"`
}

type registrationRecentDTO struct {
	CheckedInAt time.Time `json:"checkedInAt"`
	TicketID    uint      `json:"ticketId"`
	ZoneType    string    `json:"zoneType"`
	SeatRow     int       `json:"seatRow"`
	SeatColumn  int       `json:"seatColumn"`
	GateID      int       `json:"gateId"`
	Status      string    `json:"status"`
}

type registrationDashboardDTO struct {
	ConcertID    string                  `json:"concertId"`
	ConcertName  string                  `json:"concertName"`
	ConcertDate  string                  `json:"concertDate"`
	TotalTickets int64                   `json:"totalTickets"`
	CheckedIn    int64                   `json:"checkedIn"`
	Remaining    int64                   `json:"remaining"`
	Gates        []registrationGateDTO   `json:"gates"`
	Recent       []registrationRecentDTO `json:"recent"`
}

type registrationConcertDTO struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Date     string `json:"date"`
	EndDate  string `json:"endDate"`
	Location string `json:"location"`
	Status   string `json:"status"`
}

func RegisterRoutes(app *fiber.App, db *gorm.DB) {
	handler := &RegistrationHandler{db: db}
	group := app.Group("/api/event-registration")
	group.Get("/concerts", handler.listConcerts)
	group.Get("/tickets/:ticketID", handler.lookupTicket)
	group.Get("/tickets/:ticketID/image", handler.getTicketImage)
	group.Put("/tickets/:ticketID/image", handler.storeTicketImage)
	group.Get("/concerts/:concertID/dashboard", handler.dashboard)
	group.Post("/check-ins", handler.checkIn)
}

func (h *RegistrationHandler) listConcerts(c *fiber.Ctx) error {
	var concerts []models.Concert
	if err := h.db.Order("start_date DESC").Find(&concerts).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load concerts", err)
	}
	result := make([]registrationConcertDTO, 0, len(concerts))
	for _, concert := range concerts {
		result = append(result, registrationConcertDTO{
			ID: concert.ConcertID, Name: concert.ConcertName, Date: concert.StartDate,
			EndDate: concert.EndDate, Location: concert.Location, Status: concert.Status,
		})
	}
	return c.JSON(result)
}

func (h *RegistrationHandler) storeTicketImage(c *fiber.Ctx) error {
	if !isPNGRequest(c) || len(c.Body()) == 0 {
		return apiError(c, fiber.StatusBadRequest, "a non-empty image/png body is required", nil)
	}
	ticketID, err := parseTicketID(c.Params("ticketID"))
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid ticket id", err)
	}
	result := h.db.Model(&models.Ticket{}).Where("ticket_id = ?", ticketID).Update("image_ticket", append([]byte(nil), c.Body()...))
	if result.Error != nil {
		return apiError(c, fiber.StatusInternalServerError, "store ticket image", result.Error)
	}
	if result.RowsAffected == 0 {
		return apiError(c, fiber.StatusNotFound, "ticket not found", nil)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *RegistrationHandler) getTicketImage(c *fiber.Ctx) error {
	ticketID, parseErr := parseTicketID(c.Params("ticketID"))
	if parseErr != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid ticket id", parseErr)
	}
	var ticket models.Ticket
	if err := h.db.Select("ticket_id", "image_ticket").First(&ticket, "ticket_id = ?", ticketID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "ticket not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load ticket image", err)
	}
	if len(ticket.ImageTicket) == 0 {
		return apiError(c, fiber.StatusNotFound, "ticket image not found", nil)
	}
	c.Set(fiber.HeaderContentType, "image/png")
	return c.Send(ticket.ImageTicket)
}

func isPNGRequest(c *fiber.Ctx) bool {
	return strings.EqualFold(strings.TrimSpace(strings.Split(c.Get(fiber.HeaderContentType), ";")[0]), "image/png")
}

func (h *RegistrationHandler) lookupTicket(c *fiber.Ctx) error {
	ticketID, parseErr := parseTicketID(c.Params("ticketID"))
	if parseErr != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid ticket id", parseErr)
	}
	ticket, err := h.loadTicket(ticketID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiErrorCode(c, fiber.StatusNotFound, "TICKET_NOT_FOUND", "ticket not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load ticket", err)
	}
	result, err := h.registrationTicket(ticket)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load check-in status", err)
	}
	if concertID := strings.TrimSpace(c.Query("concertId")); concertID != "" && result.ConcertID != concertID {
		result.ErrorCode = "WRONG_CONCERT"
		result.ErrorMessage = "ticket belongs to another concert"
		return c.Status(fiber.StatusConflict).JSON(result)
	}
	if statusErr := ticketStatusError(ticket.StatusTicket, result.CheckedIn); statusErr != nil {
		if errors.Is(statusErr, errTicketUsed) {
			result.ErrorCode = "TICKET_USED"
			result.ErrorMessage = "ticket has already been used"
		} else {
			result.ErrorCode = "TICKET_UNAVAILABLE"
			result.ErrorMessage = "ticket is not ready for check-in"
		}
		return c.Status(fiber.StatusConflict).JSON(result)
	}
	return c.JSON(result)
}

func (h *RegistrationHandler) dashboard(c *fiber.Ctx) error {
	concertID := strings.TrimSpace(c.Params("concertID"))
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", concertID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "concert not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load concert", err)
	}

	result := registrationDashboardDTO{ConcertID: concert.ConcertID, ConcertName: concert.ConcertName, ConcertDate: concert.StartDate, Gates: make([]registrationGateDTO, 4), Recent: []registrationRecentDTO{}}
	tickets := h.db.Table(`tickets AS t`).Joins(`JOIN seats AS s ON s.seat_id = t.seat_id`).Joins(`JOIN zones AS z ON z.zone_id = s.zone_id`).Where("z.concert_id = ?", concertID)
	if err := tickets.Count(&result.TotalTickets).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "count concert tickets", err)
	}
	if err := h.db.Table(`gate_check_ins AS g`).Joins(`JOIN tickets AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN seats AS s ON s.seat_id = t.seat_id`).Joins(`JOIN zones AS z ON z.zone_id = s.zone_id`).Where("z.concert_id = ?", concertID).Count(&result.CheckedIn).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "count concert check-ins", err)
	}
	result.Remaining = result.TotalTickets - result.CheckedIn
	if result.Remaining < 0 {
		result.Remaining = 0
	}

	type gateAggregate struct {
		GateID      int
		CheckedIn   int64
		LastCheckIn *time.Time
	}
	var aggregates []gateAggregate
	if err := h.db.Table(`gate_check_ins AS g`).Select("g.gate_id, COUNT(*) AS checked_in, MAX(g.gate_date_time) AS last_check_in").Joins(`JOIN tickets AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN seats AS s ON s.seat_id = t.seat_id`).Joins(`JOIN zones AS z ON z.zone_id = s.zone_id`).Where("z.concert_id = ?", concertID).Group("g.gate_id").Scan(&aggregates).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "aggregate gates", err)
	}
	for index := range result.Gates {
		result.Gates[index].GateID = index + 1
	}
	for _, aggregate := range aggregates {
		if aggregate.GateID < 1 || aggregate.GateID > len(result.Gates) {
			continue
		}
		gate := &result.Gates[aggregate.GateID-1]
		gate.CheckedIn = aggregate.CheckedIn
		gate.LastCheckIn = aggregate.LastCheckIn
		if result.TotalTickets > 0 {
			gate.Percentage = float64(aggregate.CheckedIn) * 100 / float64(result.TotalTickets)
		}
	}

	if err := h.db.Table(`gate_check_ins AS g`).Select("g.gate_date_time AS checked_in_at, g.ticket_id, z.zone_type, s.seat_row, s.seat_column, g.gate_id, g.check_in_status AS status").Joins(`JOIN tickets AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN seats AS s ON s.seat_id = t.seat_id`).Joins(`JOIN zones AS z ON z.zone_id = s.zone_id`).Where("z.concert_id = ?", concertID).Order("g.gate_date_time DESC").Limit(10).Scan(&result.Recent).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load recent check-ins", err)
	}
	return c.JSON(result)
}

func (h *RegistrationHandler) checkIn(c *fiber.Ctx) error {
	var request checkInRequest
	if err := c.BodyParser(&request); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	request.ConcertID = strings.TrimSpace(request.ConcertID)
	ticketID := uint(request.TicketID)
	if ticketID == 0 || request.GateID <= 0 || request.ConcertID == "" {
		return apiError(c, fiber.StatusBadRequest, "ticketId, concertId and a positive gateId are required", nil)
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var ticket models.Ticket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ticket, "ticket_id = ?", ticketID).Error; err != nil {
			return err
		}
		var seat models.Seat
		if err := tx.First(&seat, "seat_id = ?", ticket.SeatID).Error; err != nil {
			return err
		}
		var zone models.Zone
		if err := tx.First(&zone, "zone_id = ?", seat.ZoneID).Error; err != nil {
			return err
		}
		if !ticketBelongsToConcert(zone, request.ConcertID) {
			return errTicketWrongConcert
		}
		var existing models.GateCheckIn
		if err := tx.First(&existing, "ticket_id = ?", ticketID).Error; err == nil {
			return errTicketUsed
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if statusErr := ticketStatusError(ticket.StatusTicket, false); statusErr != nil {
			return statusErr
		}

		entry := models.GateCheckIn{
			TicketID: ticketID, GateID: request.GateID,
			GateDateTime: time.Now(), CheckInStatus: "SUCCESS",
		}
		if err := tx.Create(&entry).Error; err != nil {
			if isUniqueConflict(err) {
				return errTicketUsed
			}
			return err
		}
		return tx.Model(&models.Ticket{}).Where("ticket_id = ?", ticketID).Update("status_ticket", "USED").Error
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			return apiErrorCode(c, fiber.StatusNotFound, "TICKET_NOT_FOUND", "ticket not found", nil)
		case errors.Is(err, errTicketUsed):
			return apiErrorCode(c, fiber.StatusConflict, "TICKET_USED", "ticket has already been used", nil)
		case errors.Is(err, errTicketUnavailable):
			return apiErrorCode(c, fiber.StatusConflict, "TICKET_UNAVAILABLE", "ticket is not ready for check-in", nil)
		case errors.Is(err, errTicketWrongConcert):
			return apiErrorCode(c, fiber.StatusConflict, "WRONG_CONCERT", "ticket belongs to another concert", nil)
		default:
			return apiError(c, fiber.StatusInternalServerError, "check in ticket", err)
		}
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"ticketId": ticketID,
		"gateId":   request.GateID,
		"status":   "SUCCESS",
	})
}

func (h *RegistrationHandler) loadTicket(ticketID uint) (models.Ticket, error) {
	var ticket models.Ticket
	err := h.db.First(&ticket, "ticket_id = ?", ticketID).Error
	return ticket, err
}

func (h *RegistrationHandler) registrationTicket(ticket models.Ticket) (registrationTicketDTO, error) {
	var seat models.Seat
	if err := h.db.First(&seat, "seat_id = ?", ticket.SeatID).Error; err != nil {
		return registrationTicketDTO{}, err
	}
	var zone models.Zone
	if err := h.db.First(&zone, "zone_id = ?", seat.ZoneID).Error; err != nil {
		return registrationTicketDTO{}, err
	}
	var checkIn models.GateCheckIn
	checkInErr := h.db.Order("gate_date_time DESC").First(&checkIn, "ticket_id = ?", ticket.TicketID).Error
	if checkInErr != nil && !errors.Is(checkInErr, gorm.ErrRecordNotFound) {
		return registrationTicketDTO{}, checkInErr
	}
	result := registrationTicketDTO{
		TicketID: ticket.TicketID, ConcertID: zone.ConcertID, ConcertName: ticket.NameConcert, TicketDateTime: ticket.TicketDateTime,
		TicketImageURL: ticketImageURL(ticket), TicketStatus: ticket.StatusTicket,
		SeatID: ticket.SeatID, SeatRow: seat.SeatRow, SeatColumn: seat.SeatColumn,
		ZoneID: seat.ZoneID, ZoneType: zone.ZoneType, CheckedIn: checkInErr == nil,
	}
	if checkInErr == nil {
		result.CheckedInAt = &checkIn.GateDateTime
		result.GateID = checkIn.GateID
	}
	return result, nil
}

func ticketBelongsToConcert(zone models.Zone, concertID string) bool {
	return strings.TrimSpace(concertID) != "" && zone.ConcertID == strings.TrimSpace(concertID)
}

func ticketImageURL(ticket models.Ticket) string {
	if len(ticket.ImageTicket) == 0 {
		return ""
	}
	return fmt.Sprintf("/api/event-registration/tickets/%d/image", ticket.TicketID)
}

func parseTicketID(value string) (uint, error) {
	normalized := strings.TrimSpace(strings.ToUpper(value))
	if strings.HasPrefix(normalized, "OCTAVIA|") {
		parts := strings.Split(normalized, "|")
		if len(parts) < 2 {
			return 0, fmt.Errorf("invalid ticket id %q", value)
		}
		normalized = strings.TrimSpace(parts[1])
	}
	normalized = strings.TrimPrefix(normalized, "#")
	normalized = strings.TrimPrefix(normalized, "TK-")
	parsed, err := strconv.ParseUint(normalized, 10, 64)
	if err != nil || parsed == 0 {
		return 0, fmt.Errorf("invalid ticket id %q", value)
	}
	return uint(parsed), nil
}

func ticketStatusError(status string, checkedIn bool) error {
	if checkedIn || strings.EqualFold(strings.TrimSpace(status), "USED") {
		return errTicketUsed
	}
	if !CanCheckIn(status) {
		return errTicketUnavailable
	}
	return nil
}

func CanCheckIn(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "READY", "ACTIVE", "VALID", "พร้อมใช้งาน":
		return true
	default:
		return false
	}
}

func isUniqueConflict(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key") || strings.Contains(message, "unique constraint")
}

func apiError(c *fiber.Ctx, status int, message string, err error) error {
	payload := fiber.Map{"error": message}
	if err != nil {
		payload["detail"] = err.Error()
	}
	return c.Status(status).JSON(payload)
}

func apiErrorCode(c *fiber.Ctx, status int, code, message string, err error) error {
	payload := fiber.Map{"code": code, "error": message}
	if err != nil {
		payload["detail"] = err.Error()
	}
	return c.Status(status).JSON(payload)
}
