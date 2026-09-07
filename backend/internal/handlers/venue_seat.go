package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VenueSeatHandler struct{ db *gorm.DB }

func RegisterVenueSeatRoutes(app *fiber.App, db *gorm.DB) {
	h := &VenueSeatHandler{db: db}
	g := app.Group("/api/venue-seat")
	g.Get("/concerts", h.listConcerts)
	g.Get("/concerts/:id", h.getConcert)
	g.Put("/concerts/:id/publication", h.savePublication)
	g.Get("/concerts/:id/layout", h.getLayout)
	g.Put("/concerts/:id/layout", h.saveLayout)
	g.Delete("/concerts/:id/layout", h.clearLayout)
}

type roundDTO struct {
	ID               string `json:"id"`
	PerformanceOrder int    `json:"performanceOrder"`
	Date             string `json:"date"`
	DoorTime         string `json:"doorTime"`
	StartShow        string `json:"startShow"`
	EndShow          string `json:"endShow"`
	Status           string `json:"status"`
}

type publishingDTO struct {
	Description string `json:"description"`
	PosterImage string `json:"posterImage"`
	SaleStart   string `json:"saleStart"`
	SaleEnd     string `json:"saleEnd"`
	PublishAt   string `json:"publishAt"`
	UnpublishAt string `json:"unpublishAt"`
}

type seatDTO struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	SeatRow    string  `json:"seatRow"`
	SeatColumn string  `json:"seatColumn"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Rotation   float64 `json:"rotation"`
	Disabled   bool    `json:"disabled"`
}

type zoneDTO struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	Seats     int       `json:"seats"`
	SeatItems []seatDTO `json:"seatItems"`
	Price     float64   `json:"price"`
	Type      string    `json:"type"`
	Shape     string    `json:"shape"`
	X         float64   `json:"x"`
	Y         float64   `json:"y"`
	Width     float64   `json:"width"`
	Height    float64   `json:"height"`
	Rotation  float64   `json:"rotation"`
	Layer     int64     `json:"z"`
}

type layoutObjectDTO struct {
	ID        string  `json:"id"`
	Kind      string  `json:"kind"`
	Shape     string  `json:"shape"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	TextColor string  `json:"textColor"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
	Rotation  float64 `json:"rotation"`
	Layer     int64   `json:"z"`
}

type concertPlanDTO struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Artist      string        `json:"artist"`
	Date        string        `json:"date"`
	EndDate     string        `json:"endDate"`
	Location    string        `json:"location"`
	Status      string        `json:"status"`
	Description string        `json:"description"`
	Cover       string        `json:"cover"`
	Rounds      []roundDTO    `json:"rounds"`
	Publishing  publishingDTO `json:"publishing"`
}

type layoutDTO struct {
	Zones         []zoneDTO         `json:"zones"`
	LayoutObjects []layoutObjectDTO `json:"layoutObjects"`
	Flowchart     string            `json:"flowchart,omitempty"`
}

func (h *VenueSeatHandler) listConcerts(c *fiber.Ctx) error {
	var concerts []models.Concert
	if err := h.db.Order("start_date DESC").Find(&concerts).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load concerts", err)
	}
	result := make([]concertPlanDTO, 0, len(concerts))
	for _, concert := range concerts {
		result = append(result, h.concertSummary(concert))
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) getConcert(c *fiber.Ctx) error {
	concert, err := h.findConcert(c.Params("id"))
	if err != nil {
		return h.concertError(c, err)
	}
	result := h.concertSummary(concert)

	var schedules []models.PerformanceSchedule
	if err := h.db.Where("concert_id = ?", concert.ConcertID).Order("performance_order, start_show").Find(&schedules).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load performance schedules", err)
	}
	result.Rounds = make([]roundDTO, 0, len(schedules))
	for _, schedule := range schedules {
		result.Rounds = append(result.Rounds, roundDTO{
			ID: schedule.ScheduleID, PerformanceOrder: schedule.PerformanceOrder,
			Date: dateOnly(concert.StartDate), DoorTime: clockOnly(concert.TimeOpenGate),
			StartShow: clockOnly(schedule.StartShow), EndShow: clockOnly(schedule.EndShow),
			Status: concert.Status,
		})
	}

	var publication models.Publication
	if err := h.db.First(&publication, "concert_id = ?", concert.ConcertID).Error; err == nil {
		result.Publishing = publicationDTO(publication)
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return apiError(c, fiber.StatusInternalServerError, "load publication", err)
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) savePublication(c *fiber.Ctx) error {
	concert, err := h.findConcert(c.Params("id"))
	if err != nil {
		return h.concertError(c, err)
	}
	var payload publishingDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid publication body", err)
	}

	saleStart, err := parseOptionalDateTimeStrict(payload.SaleStart)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid sale open date", err)
	}
	saleEnd, err := parseOptionalDateTimeStrict(payload.SaleEnd)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid booking close date", err)
	}
	publishAt, err := parseOptionalDateTimeStrict(payload.PublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid web publish date", err)
	}
	unpublishAt, err := parseOptionalDateTimeStrict(payload.UnpublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid web unpublish date", err)
	}
	poster, err := decodeOptionalDataImage(payload.PosterImage)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid publication image", err)
	}
	if saleStart != nil && saleEnd != nil && saleEnd.Before(*saleStart) {
		return apiError(c, fiber.StatusBadRequest, "booking close date must be after sale open date", nil)
	}
	if publishAt != nil && unpublishAt != nil && unpublishAt.Before(*publishAt) {
		return apiError(c, fiber.StatusBadRequest, "web unpublish date must be after publish date", nil)
	}

	publication := models.Publication{
		ConcertID: concert.ConcertID, Describtion: strings.TrimSpace(payload.Description),
		PosterWeb: poster, SaleOpenDate: saleStart, BookingCloseDatetime: saleEnd,
		OpenInWeb: publishAt, OutWeb: unpublishAt,
	}
	if err := h.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "concert_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"sale_open_date", "booking_close_datetime", "openinweb", "describtion", "outweb", "poster_web", "updated_at",
		}),
	}).Create(&publication).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "save publication", err)
	}
	if err := h.db.First(&publication, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload publication", err)
	}
	return c.JSON(publicationDTO(publication))
}

func (h *VenueSeatHandler) getLayout(c *fiber.Ctx) error {
	concert, err := h.findConcert(c.Params("id"))
	if err != nil {
		return h.concertError(c, err)
	}
	result, err := h.buildLayout(concert)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load seating layout", err)
	}
	return c.JSON(result)
}

var errBookedSeats = errors.New("seat has a booking")
var errInvalidLayout = errors.New("invalid layout")

func (h *VenueSeatHandler) saveLayout(c *fiber.Ctx) error {
	concert, err := h.findConcert(c.Params("id"))
	if err != nil {
		return h.concertError(c, err)
	}
	var payload layoutDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid layout body", err)
	}
	seatCount := 0
	for _, zone := range payload.Zones {
		seatCount += len(zone.SeatItems)
	}
	if seatCount == 0 {
		return apiError(c, fiber.StatusBadRequest, "layout must contain at least one seat", nil)
	}
	flowchart, err := decodeRequiredDataImage(payload.Flowchart)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid flowchart image", err)
	}
	objectsJSON, err := json.Marshal(payload.LayoutObjects)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid layout objects", err)
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		var existingSeats []models.Seat
		if err := tx.Where("concert_id = ?", concert.ConcertID).Find(&existingSeats).Error; err != nil {
			return err
		}
		existingByID := make(map[int]models.Seat, len(existingSeats))
		for _, seat := range existingSeats {
			existingByID[seat.SeatID] = seat
		}
		keptSeatIDs := make(map[int]bool, len(existingSeats))
		zoneIDs := make(map[string]bool, len(payload.Zones))
		payloadSeatIDs := make(map[int]bool, seatCount)

		for _, item := range payload.Zones {
			zoneID := strings.TrimSpace(item.ID)
			if zoneID == "" {
				zoneID = models.GenerateID("ZN")
			}
			if zoneIDs[zoneID] {
				return fmt.Errorf("%w: duplicate zone id %q", errInvalidLayout, zoneID)
			}
			zoneIDs[zoneID] = true
			var owner models.Zone
			if err := tx.Select("zone_id", "concert_id").First(&owner, "zone_id = ?", zoneID).Error; err == nil {
				if owner.ConcertID != concert.ConcertID {
					return fmt.Errorf("%w: zone %q belongs to another concert", errInvalidLayout, zoneID)
				}
			} else if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			zone := models.Zone{
				ZoneID: zoneID, ConcertID: concert.ConcertID, ZoneName: strings.TrimSpace(item.Name),
				ZoneType: item.Type, Capacity: len(item.SeatItems), Color: item.Color, Shape: item.Shape,
				PositionX: item.X, PositionY: item.Y, Width: item.Width, Height: item.Height,
				Rotation: item.Rotation, LayerOrder: item.Layer,
			}
			if zone.ZoneName == "" {
				return fmt.Errorf("%w: zone name is required", errInvalidLayout)
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "zone_id"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"concert_id", "zone_name", "zone_type", "capacity", "color", "shape",
					"position_x", "position_y", "width", "height", "rotation", "layer_order",
				}),
			}).Create(&zone).Error; err != nil {
				return err
			}

			for _, itemSeat := range item.SeatItems {
				requestedSeatID, _ := strconv.Atoi(itemSeat.ID)
				if requestedSeatID > 0 {
					if payloadSeatIDs[requestedSeatID] {
						return fmt.Errorf("%w: duplicate seat id %d", errInvalidLayout, requestedSeatID)
					}
					payloadSeatIDs[requestedSeatID] = true
				}
				row, column := itemSeat.SeatRow, itemSeat.SeatColumn
				if row == "" && column == "" {
					row, column = splitSeatName(itemSeat.Name)
				}
				status := "available"
				if itemSeat.Disabled {
					status = "disabled"
				}
				seat, exists := existingByID[requestedSeatID]
				if !exists {
					seat = models.Seat{}
				}
				seat.SeatColumn, seat.SeatRow, seat.StatusSeat = column, row, status
				seat.ConcertID, seat.ZoneID = concert.ConcertID, zoneID
				seat.PositionX, seat.PositionY, seat.Rotation = itemSeat.X, itemSeat.Y, itemSeat.Rotation
				seat.Flowchart = flowchart
				if exists {
					if err := tx.Save(&seat).Error; err != nil {
						return err
					}
				} else if err := tx.Create(&seat).Error; err != nil {
					return err
				}
				keptSeatIDs[seat.SeatID] = true

				var ticket models.Ticket
				ticketErr := tx.First(&ticket, "seat_id = ?", seat.SeatID).Error
				if ticketErr != nil && !errors.Is(ticketErr, gorm.ErrRecordNotFound) {
					return ticketErr
				}
				if errors.Is(ticketErr, gorm.ErrRecordNotFound) {
					ticket = models.Ticket{SeatID: seat.SeatID, StatusTicket: "available"}
				}
				ticket.NameConcert = concert.ConcertName
				ticket.TicketDateTime = concertDateTime(concert)
				ticket.PriceTicket = item.Price
				if ticket.TicketID == 0 {
					if err := tx.Create(&ticket).Error; err != nil {
						return err
					}
				} else if err := tx.Model(&ticket).Updates(map[string]any{
					"name_concert": ticket.NameConcert, "ticket_date_time": ticket.TicketDateTime,
					"price_ticket": ticket.PriceTicket,
				}).Error; err != nil {
					return err
				}
			}
		}

		removed := make([]int, 0)
		for _, seat := range existingSeats {
			if !keptSeatIDs[seat.SeatID] {
				removed = append(removed, seat.SeatID)
			}
		}
		if len(removed) > 0 {
			var booked int64
			if err := tx.Model(&models.Ticket{}).Where("seat_id IN ? AND booking_id IS NOT NULL", removed).Count(&booked).Error; err != nil {
				return err
			}
			if booked > 0 {
				return errBookedSeats
			}
			if err := tx.Where("seat_id IN ?", removed).Delete(&models.Ticket{}).Error; err != nil {
				return err
			}
			if err := tx.Where("seat_id IN ?", removed).Delete(&models.Seat{}).Error; err != nil {
				return err
			}
		}
		var oldZones []models.Zone
		if err := tx.Where("concert_id = ?", concert.ConcertID).Find(&oldZones).Error; err != nil {
			return err
		}
		for _, zone := range oldZones {
			if !zoneIDs[zone.ZoneID] {
				if err := tx.Delete(&zone).Error; err != nil {
					return err
				}
			}
		}
		return tx.Model(&models.Concert{}).Where("concert_id = ?", concert.ConcertID).
			Update("layout_objects", models.JSONDocument(objectsJSON)).Error
	})
	if errors.Is(err, errBookedSeats) {
		return apiError(c, fiber.StatusConflict, "cannot remove a seat that has a booking", nil)
	}
	if errors.Is(err, errInvalidLayout) {
		return apiError(c, fiber.StatusBadRequest, "invalid seating layout", err)
	}
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "save seating layout", err)
	}
	concert, err = h.findConcert(concert.ConcertID)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload concert layout metadata", err)
	}
	result, err := h.buildLayout(concert)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload seating layout", err)
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) clearLayout(c *fiber.Ctx) error {
	concert, err := h.findConcert(c.Params("id"))
	if err != nil {
		return h.concertError(c, err)
	}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var seatIDs []int
		if err := tx.Model(&models.Seat{}).Where("concert_id = ?", concert.ConcertID).Pluck("seat_id", &seatIDs).Error; err != nil {
			return err
		}
		if len(seatIDs) > 0 {
			var booked int64
			if err := tx.Model(&models.Ticket{}).Where("seat_id IN ? AND booking_id IS NOT NULL", seatIDs).Count(&booked).Error; err != nil {
				return err
			}
			if booked > 0 {
				return errBookedSeats
			}
			if err := tx.Where("seat_id IN ?", seatIDs).Delete(&models.Ticket{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("concert_id = ?", concert.ConcertID).Delete(&models.Seat{}).Error; err != nil {
			return err
		}
		if err := tx.Where("concert_id = ?", concert.ConcertID).Delete(&models.Zone{}).Error; err != nil {
			return err
		}
		return tx.Model(&models.Concert{}).Where("concert_id = ?", concert.ConcertID).
			Update("layout_objects", models.JSONDocument("[]")).Error
	})
	if errors.Is(err, errBookedSeats) {
		return apiError(c, fiber.StatusConflict, "cannot clear a layout that has bookings", nil)
	}
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "clear seating layout", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *VenueSeatHandler) buildLayout(concert models.Concert) (layoutDTO, error) {
	result := layoutDTO{Zones: []zoneDTO{}, LayoutObjects: []layoutObjectDTO{}}
	if len(concert.LayoutObjects) > 0 {
		if err := json.Unmarshal(concert.LayoutObjects, &result.LayoutObjects); err != nil {
			return result, fmt.Errorf("decode layout objects: %w", err)
		}
	}
	var zones []models.Zone
	if err := h.db.Where("concert_id = ?", concert.ConcertID).Order("layer_order, zone_id").Find(&zones).Error; err != nil {
		return result, err
	}
	for _, zone := range zones {
		item := zoneDTO{
			ID: zone.ZoneID, Kind: "zone", Name: zone.ZoneName, Color: zone.Color,
			Seats: zone.Capacity, Type: zone.ZoneType, Shape: zone.Shape,
			X: zone.PositionX, Y: zone.PositionY, Width: zone.Width, Height: zone.Height,
			Rotation: zone.Rotation, Layer: zone.LayerOrder, SeatItems: []seatDTO{},
		}
		var seats []models.Seat
		if err := h.db.Where("zone_id = ? AND concert_id = ?", zone.ZoneID, concert.ConcertID).Order("seat_id").Find(&seats).Error; err != nil {
			return result, err
		}
		for _, seat := range seats {
			item.SeatItems = append(item.SeatItems, seatDTO{
				ID: strconv.Itoa(seat.SeatID), Name: seat.SeatRow + seat.SeatColumn,
				SeatRow: seat.SeatRow, SeatColumn: seat.SeatColumn,
				X: seat.PositionX, Y: seat.PositionY, Rotation: seat.Rotation,
				Disabled: seat.StatusSeat == "disabled",
			})
			if result.Flowchart == "" && len(seat.Flowchart) > 0 {
				result.Flowchart = imageDataURL(seat.Flowchart)
			}
		}
		var ticket models.Ticket
		if err := h.db.Joins("JOIN seats ON seats.seat_id = tickets.seat_id").
			Where("seats.zone_id = ? AND seats.concert_id = ?", zone.ZoneID, concert.ConcertID).
			Order("tickets.ticket_id").First(&ticket).Error; err == nil {
			item.Price = ticket.PriceTicket
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return result, err
		}
		result.Zones = append(result.Zones, item)
	}
	return result, nil
}

func (h *VenueSeatHandler) concertSummary(concert models.Concert) concertPlanDTO {
	poster := concert.ConcertPoster
	if len(poster) == 0 {
		poster = concert.Poster
	}
	return concertPlanDTO{
		ID: concert.ConcertID, Name: concert.ConcertName, Artist: h.artistNames(concert.ConcertID),
		Date: dateOnly(concert.StartDate), EndDate: dateOnly(concert.EndDate), Location: concert.Location,
		Status: concert.Status, Description: concert.MoreInfo, Cover: imageDataURL(poster),
		Rounds: []roundDTO{}, Publishing: publishingDTO{},
	}
}

func (h *VenueSeatHandler) artistNames(concertID string) string {
	var names []string
	h.db.Table("artists").Select("artists.artist_name").
		Joins("JOIN concert_artists ON concert_artists.artist_id = artists.artist_id").
		Where("concert_artists.concert_id = ?", concertID).Order("artists.artist_name").Pluck("artists.artist_name", &names)
	return strings.Join(names, ", ")
}

func (h *VenueSeatHandler) findConcert(id string) (models.Concert, error) {
	var concert models.Concert
	err := h.db.First(&concert, "concert_id = ?", id).Error
	return concert, err
}

func (h *VenueSeatHandler) concertError(c *fiber.Ctx, err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return apiError(c, fiber.StatusNotFound, "concert not found", nil)
	}
	return apiError(c, fiber.StatusInternalServerError, "load concert", err)
}

func publicationDTO(value models.Publication) publishingDTO {
	return publishingDTO{
		Description: value.Describtion, PosterImage: imageDataURL(value.PosterWeb),
		SaleStart:   formatOptionalDateTime(value.SaleOpenDate),
		SaleEnd:     formatOptionalDateTime(value.BookingCloseDatetime),
		PublishAt:   formatOptionalDateTime(value.OpenInWeb),
		UnpublishAt: formatOptionalDateTime(value.OutWeb),
	}
}

func splitSeatName(value string) (string, string) {
	value = strings.TrimSpace(value)
	index := len(value)
	for index > 0 && value[index-1] >= '0' && value[index-1] <= '9' {
		index--
	}
	if index == len(value) {
		return value, ""
	}
	return value[:index], value[index:]
}

func concertDateTime(concert models.Concert) time.Time {
	value := dateOnly(concert.StartDate) + " " + clockOnly(concert.StartTime)
	if parsed, err := time.ParseInLocation("2006-01-02 15:04:05", value, time.Local); err == nil {
		return parsed
	}
	return time.Now()
}

func decodeRequiredDataImage(value string) ([]byte, error) {
	if strings.TrimSpace(value) == "" {
		return nil, errors.New("image is required")
	}
	return decodeOptionalDataImage(value)
}

func decodeOptionalDataImage(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	comma := strings.IndexByte(value, ',')
	if comma < 0 || !strings.HasPrefix(value, "data:image/") || !strings.Contains(value[:comma], ";base64") {
		return nil, errors.New("expected a base64 image data URL")
	}
	decoded, err := base64.StdEncoding.DecodeString(value[comma+1:])
	if err != nil {
		return nil, err
	}
	if len(decoded) == 0 {
		return nil, errors.New("empty image")
	}
	if len(decoded) > 20*1024*1024 {
		return nil, errors.New("image exceeds 20 MB")
	}
	mime := http.DetectContentType(decoded)
	if mime != "image/png" && mime != "image/jpeg" && mime != "image/webp" {
		return nil, fmt.Errorf("unsupported image content type %s", mime)
	}
	return decoded, nil
}

func imageDataURL(value []byte) string {
	if len(value) == 0 {
		return ""
	}
	if strings.HasPrefix(string(value), "data:image/") {
		return string(value)
	}
	mime := "image/png"
	if len(value) >= 3 && value[0] == 0xff && value[1] == 0xd8 && value[2] == 0xff {
		mime = "image/jpeg"
	} else if len(value) >= 12 && string(value[:4]) == "RIFF" && string(value[8:12]) == "WEBP" {
		mime = "image/webp"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(value)
}

func parseOptionalDateTimeStrict(value string) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	for _, layout := range []string{"2006-01-02T15:04", "2006-01-02T15:04:05", time.RFC3339} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed, nil
		}
	}
	return nil, fmt.Errorf("invalid datetime %q", value)
}

func formatOptionalDateTime(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02T15:04")
}

func apiError(c *fiber.Ctx, status int, message string, err error) error {
	payload := fiber.Map{"error": message}
	if err != nil {
		payload["detail"] = err.Error()
	}
	return c.Status(status).JSON(payload)
}
