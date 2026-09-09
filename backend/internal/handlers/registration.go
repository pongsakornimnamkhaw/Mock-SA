package handlers

import (
	"errors"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var errTicketConflict = errors.New("ticket cannot be checked in")

type RegistrationHandler struct {
	db *gorm.DB
}

type checkInRequest struct {
	TicketID string `json:"ticketId"`
	GateID   int    `json:"gateId"`
}

type registrationTicketDTO struct {
	TicketID       string     `json:"ticketId"`
	ConcertName    string     `json:"concertName"`
	TicketDateTime time.Time  `json:"ticketDateTime"`
	TicketImageURL string     `json:"ticketImageUrl"`
	TicketStatus   string     `json:"ticketStatus"`
	SeatID         string     `json:"seatId"`
	SeatRow        string     `json:"seatRow"`
	SeatColumn     string     `json:"seatColumn"`
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
	TicketID    string    `json:"ticketId"`
	ZoneType    string    `json:"zoneType"`
	SeatRow     string    `json:"seatRow"`
	SeatColumn  string    `json:"seatColumn"`
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

func RegisterRegistrationRoutes(app *fiber.App, db *gorm.DB) {
	handler := &RegistrationHandler{db: db}
	group := app.Group("/api/event-registration")
	group.Get("/tickets/:ticketID", handler.lookupTicket)
	group.Get("/tickets/:ticketID/image", handler.getTicketImage)
	group.Put("/tickets/:ticketID/image", handler.storeTicketImage)
	group.Get("/concerts/:concertID/dashboard", handler.dashboard)
	group.Post("/check-ins", handler.checkIn)
}

func (h *RegistrationHandler) storeTicketImage(c *fiber.Ctx) error {
	if !isPNGRequest(c) || len(c.Body()) == 0 {
		return apiError(c, fiber.StatusBadRequest, "a non-empty image/png body is required", nil)
	}
	result := h.db.Model(&models.Ticket{}).Where("ticket_id = ?", strings.TrimSpace(c.Params("ticketID"))).Update("image_ticket", append([]byte(nil), c.Body()...))
	if result.Error != nil {
		return apiError(c, fiber.StatusInternalServerError, "store ticket image", result.Error)
	}
	if result.RowsAffected == 0 {
		return apiError(c, fiber.StatusNotFound, "ticket not found", nil)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *RegistrationHandler) getTicketImage(c *fiber.Ctx) error {
	var ticket models.Ticket
	if err := h.db.Select("ticket_id", "image_ticket").First(&ticket, "ticket_id = ?", strings.TrimSpace(c.Params("ticketID"))).Error; err != nil {
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
	ticket, err := h.loadTicket(c.Params("ticketID"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "ticket not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load ticket", err)
	}
	result, err := h.registrationTicket(ticket)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load check-in status", err)
	}
	if !ticketCanCheckIn(ticket.StatusTicket) {
		if result.CheckedIn || strings.EqualFold(strings.TrimSpace(ticket.StatusTicket), "USED") {
			return c.Status(fiber.StatusConflict).JSON(result)
		}
		return apiError(c, fiber.StatusConflict, "ticket is not available for check-in", nil)
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
	tickets := h.db.Table(`"Ticket" AS t`).Joins(`JOIN "Seat" AS s ON s.seat_id = t.seat_id`).Where("s.concert_id = ?", concertID)
	if err := tickets.Count(&result.TotalTickets).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "count concert tickets", err)
	}
	if err := h.db.Table(`"Gate-Check-in" AS g`).Joins(`JOIN "Ticket" AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN "Seat" AS s ON s.seat_id = t.seat_id`).Where("s.concert_id = ?", concertID).Count(&result.CheckedIn).Error; err != nil {
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
	if err := h.db.Table(`"Gate-Check-in" AS g`).Select("g.gate_id, COUNT(*) AS checked_in, MAX(g.gate_datetime) AS last_check_in").Joins(`JOIN "Ticket" AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN "Seat" AS s ON s.seat_id = t.seat_id`).Where("s.concert_id = ?", concertID).Group("g.gate_id").Scan(&aggregates).Error; err != nil {
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

	if err := h.db.Table(`"Gate-Check-in" AS g`).Select("g.gate_datetime AS checked_in_at, g.ticket_id, z.zone_type, s.seat_row, s.seat_column, g.gate_id, g.check_in_status AS status").Joins(`JOIN "Ticket" AS t ON t.ticket_id = g.ticket_id`).Joins(`JOIN "Seat" AS s ON s.seat_id = t.seat_id`).Joins(`JOIN "Zone" AS z ON z.zone_id = s.zone_id`).Where("s.concert_id = ?", concertID).Order("g.gate_datetime DESC").Limit(10).Scan(&result.Recent).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load recent check-ins", err)
	}
	return c.JSON(result)
}

func (h *RegistrationHandler) checkIn(c *fiber.Ctx) error {
	var request checkInRequest
	if err := c.BodyParser(&request); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	request.TicketID = strings.TrimSpace(request.TicketID)
	if request.TicketID == "" || request.GateID <= 0 {
		return apiError(c, fiber.StatusBadRequest, "ticketId and a positive gateId are required", nil)
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var ticket models.Ticket
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ticket, "ticket_id = ?", request.TicketID).Error; err != nil {
			return err
		}
		if !ticketCanCheckIn(ticket.StatusTicket) {
			return errTicketConflict
		}
		var existing models.GateCheckIn
		if err := tx.First(&existing, "ticket_id = ?", request.TicketID).Error; err == nil {
			return errTicketConflict
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		entry := models.GateCheckIn{
			TicketID: request.TicketID, GateID: request.GateID,
			GateDateTime: time.Now(), CheckInStatus: "SUCCESS",
		}
		if err := tx.Create(&entry).Error; err != nil {
			if isUniqueConflict(err) {
				return errTicketConflict
			}
			return err
		}
		return tx.Model(&models.Ticket{}).Where("ticket_id = ?", request.TicketID).Update("status_ticket", "USED").Error
	})
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			return apiError(c, fiber.StatusNotFound, "ticket not found", nil)
		case errors.Is(err, errTicketConflict):
			return apiError(c, fiber.StatusConflict, "ticket has already been used or is unavailable", nil)
		default:
			return apiError(c, fiber.StatusInternalServerError, "check in ticket", err)
		}
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"ticketId": request.TicketID,
		"gateId":   request.GateID,
		"status":   "SUCCESS",
	})
}

func (h *RegistrationHandler) loadTicket(ticketID string) (models.Ticket, error) {
	var ticket models.Ticket
	err := h.db.First(&ticket, "ticket_id = ?", strings.TrimSpace(ticketID)).Error
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
	checkInErr := h.db.Order("gate_datetime DESC").First(&checkIn, "ticket_id = ?", ticket.TicketID).Error
	if checkInErr != nil && !errors.Is(checkInErr, gorm.ErrRecordNotFound) {
		return registrationTicketDTO{}, checkInErr
	}
	result := registrationTicketDTO{
		TicketID: ticket.TicketID, ConcertName: ticket.NameConcert, TicketDateTime: ticket.TicketDateTime,
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

func ticketImageURL(ticket models.Ticket) string {
	if len(ticket.ImageTicket) == 0 {
		return ""
	}
	return "/api/event-registration/tickets/" + ticket.TicketID + "/image"
}

func ticketCanCheckIn(status string) bool {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "READY", "ACTIVE", "VALID":
		return true
	default:
		return false
	}
}

func isUniqueConflict(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key") || strings.Contains(message, "unique constraint")
}
