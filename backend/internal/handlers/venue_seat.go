package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VenueSeatHandler struct {
	db *gorm.DB
}

func RegisterVenueSeatRoutes(app *fiber.App, db *gorm.DB) {
	handler := &VenueSeatHandler{db: db}
	group := app.Group("/api/venue-seat")
	group.Get("/concerts", handler.listConcerts)
	group.Get("/concerts/:id", handler.getConcert)
	group.Post("/concerts", handler.createConcert)
	group.Put("/concerts/:id", handler.updateConcert)
	group.Put("/concerts/:id/layout", handler.saveLayout)
	group.Get("/concerts/:id/seat-layout-image", handler.getSeatLayoutImage)
	group.Put("/concerts/:id/seat-layout-image", handler.storeSeatLayoutImage)
	group.Delete("/concerts/:id/layout", handler.clearLayout)
}

type roundDTO struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Date     string `json:"date"`
	DoorTime string `json:"doorTime"`
	Status   string `json:"status"`
}

type publishingDTO struct {
	ScheduleFile  string `json:"scheduleFile"`
	ScheduleImage string `json:"scheduleImage"`
	Description   string `json:"description"`
	SaleStart     string `json:"saleStart"`
	SaleEnd       string `json:"saleEnd"`
	PublishAt     string `json:"publishAt"`
	UnpublishAt   string `json:"unpublishAt"`
}

type seatDTO struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Disabled bool    `json:"disabled"`
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
	ID          string  `json:"id"`
	Kind        string  `json:"kind"`
	Shape       string  `json:"shape"`
	Name        string  `json:"name"`
	Color       string  `json:"color"`
	TextColor   string  `json:"textColor"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Width       float64 `json:"width"`
	Height      float64 `json:"height"`
	Rotation    float64 `json:"rotation"`
	Layer       int64   `json:"z"`
	Side        string  `json:"side,omitempty"`
	ImageSrc    string  `json:"imageSrc,omitempty"`
	FontSize    float64 `json:"fontSize,omitempty"`
	AspectRatio float64 `json:"aspectRatio,omitempty"`
}

type concertPlanDTO struct {
	ID                  string            `json:"id"`
	Name                string            `json:"name"`
	Artist              string            `json:"artist"`
	Date                string            `json:"date"`
	EndDate             string            `json:"endDate"`
	Location            string            `json:"location"`
	Category            string            `json:"category"`
	Status              string            `json:"status"`
	Description         string            `json:"description"`
	Cover               string            `json:"cover"`
	Rounds              []roundDTO        `json:"rounds"`
	Publishing          publishingDTO     `json:"publishing"`
	Zones               []zoneDTO         `json:"zones"`
	LayoutObjects       []layoutObjectDTO `json:"layoutObjects"`
	TicketLayoutObjects []layoutObjectDTO `json:"ticketLayoutObjects"`
	SeatLayoutImageURL  string            `json:"seatLayoutImageUrl,omitempty"`
}

type layoutDTO struct {
	Zones               []zoneDTO         `json:"zones"`
	LayoutObjects       []layoutObjectDTO `json:"layoutObjects"`
	TicketLayoutObjects []layoutObjectDTO `json:"ticketLayoutObjects"`
}

func (h *VenueSeatHandler) listConcerts(c *fiber.Ctx) error {
	var concerts []models.Concert
	if err := h.db.Order("start_date DESC").Find(&concerts).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load concerts", err)
	}

	result := make([]concertPlanDTO, 0, len(concerts))
	for _, concert := range concerts {
		item, err := h.buildConcertDTO(concert)
		if err != nil {
			return apiError(c, fiber.StatusInternalServerError, "load concert plan", err)
		}
		result = append(result, item)
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) getConcert(c *fiber.Ctx) error {
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", c.Params("id")).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "concert not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load concert", err)
	}
	result, err := h.buildConcertDTO(concert)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load concert plan", err)
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) storeSeatLayoutImage(c *fiber.Ctx) error {
	if !isPNGRequest(c) || len(c.Body()) == 0 {
		return apiError(c, fiber.StatusBadRequest, "a non-empty image/png body is required", nil)
	}
	result := h.db.Model(&models.Concert{}).Where("concert_id = ?", strings.TrimSpace(c.Params("id"))).Update("seat_layout_image", append([]byte(nil), c.Body()...))
	if result.Error != nil {
		return apiError(c, fiber.StatusInternalServerError, "store seat layout image", result.Error)
	}
	if result.RowsAffected == 0 {
		return apiError(c, fiber.StatusNotFound, "concert not found", nil)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *VenueSeatHandler) getSeatLayoutImage(c *fiber.Ctx) error {
	var concert models.Concert
	if err := h.db.Select("concert_id", "seat_layout_image").First(&concert, "concert_id = ?", strings.TrimSpace(c.Params("id"))).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "concert not found", nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "load seat layout image", err)
	}
	if len(concert.SeatLayoutImage) == 0 {
		return apiError(c, fiber.StatusNotFound, "seat layout image not found", nil)
	}
	c.Set(fiber.HeaderContentType, "image/png")
	return c.Send(concert.SeatLayoutImage)
}

func (h *VenueSeatHandler) createConcert(c *fiber.Ctx) error {
	var payload concertPlanDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	if payload.ID == "" {
		payload.ID = uuid.NewString()
	}
	return h.persistConcert(c, payload.ID, payload)
}

func (h *VenueSeatHandler) updateConcert(c *fiber.Ctx) error {
	var payload concertPlanDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	return h.persistConcert(c, c.Params("id"), payload)
}

func (h *VenueSeatHandler) persistConcert(c *fiber.Ctx, concertID string, payload concertPlanDTO) error {
	if strings.TrimSpace(payload.Name) == "" {
		return apiError(c, fiber.StatusBadRequest, "concert name is required", nil)
	}
	startDate, err := parseDate(payload.Date)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid concert date", err)
	}
	endDate := startDate
	if payload.EndDate != "" {
		endDate, err = parseDate(payload.EndDate)
		if err != nil {
			return apiError(c, fiber.StatusBadRequest, "invalid end date", err)
		}
	}
	if endDate.Before(startDate) {
		return apiError(c, fiber.StatusBadRequest, "end date must not be before start date", nil)
	}
	saleStart, err := parseOptionalDateTimeStrict(payload.Publishing.SaleStart)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid sale start", err)
	}
	saleEnd, err := parseOptionalDateTimeStrict(payload.Publishing.SaleEnd)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid sale end", err)
	}
	publishAt, err := parseOptionalDateTimeStrict(payload.Publishing.PublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid publish date", err)
	}
	unpublishAt, err := parseOptionalDateTimeStrict(payload.Publishing.UnpublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid unpublish date", err)
	}
	if saleStart != nil && saleEnd != nil && saleEnd.Before(*saleStart) {
		return apiError(c, fiber.StatusBadRequest, "sale end must not be before sale start", nil)
	}
	if publishAt != nil && unpublishAt != nil && unpublishAt.Before(*publishAt) {
		return apiError(c, fiber.StatusBadRequest, "unpublish date must not be before publish date", nil)
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		var concert models.Concert
		lookup := tx.First(&concert, "concert_id = ?", concertID).Error
		if lookup != nil && !errors.Is(lookup, gorm.ErrRecordNotFound) {
			return lookup
		}

		if errors.Is(lookup, gorm.ErrRecordNotFound) {
			concert = models.Concert{ConcertID: concertID}
		}
		concert.ConcertName = payload.Name
		concert.StartDate = formatDate(startDate)
		concert.EndDate = formatDate(endDate)
		concert.Location = payload.Location
		concert.Status = payload.Status
		concert.MoreInfo = payload.Description
		concert.Poster = []byte(payload.Cover)
		concert.ConcertPoster = []byte(payload.Cover)

		if errors.Is(lookup, gorm.ErrRecordNotFound) {
			concert.StartTime = "00:00:00"
			concert.EndTime = "00:00:00"
			if err := tx.Create(&concert).Error; err != nil {
				return err
			}
		} else if err := tx.Model(&models.Concert{}).Where("concert_id = ?", concertID).Updates(map[string]any{
			"concert_name":   payload.Name,
			"start_date":     formatDate(startDate),
			"end_date":       formatDate(endDate),
			"location":       payload.Location,
			"status":         payload.Status,
			"more_info":      payload.Description,
			"poster":         []byte(payload.Cover),
			"concert_poster": []byte(payload.Cover),
			"updated_at":     time.Now(),
		}).Error; err != nil {
			return err
		}

		publication := models.Publication{
			PublicationID:        "publication-" + concertID,
			ConcertID:            concertID,
			SaleOpenDate:         saleStart,
			BookingCloseDatetime: saleEnd,
			OpenInWeb:            publishAt,
			OutWeb:               unpublishAt,
			Description:          payload.Publishing.Description,
			PosterWeb:            payload.Publishing.ScheduleImage,
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "concert_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"sale_open_date", "booking_close_datetime", "open_in_web", "out_web", "description", "poster_web", "updated_at",
			}),
		}).Create(&publication).Error
	})
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "save concert plan", err)
	}

	var saved models.Concert
	if err := h.db.First(&saved, "concert_id = ?", concertID).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload concert", err)
	}
	result, err := h.buildConcertDTO(saved)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload concert plan", err)
	}
	return c.JSON(result)
}

func (h *VenueSeatHandler) saveLayout(c *fiber.Ctx) error {
	concertID := c.Params("id")
	var payload layoutDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid layout body", err)
	}
	for _, item := range payload.Zones {
		if item.Seats < 0 {
			return apiError(c, fiber.StatusBadRequest, "zone capacity must not be negative", nil)
		}
		if item.Price < 0 {
			return apiError(c, fiber.StatusBadRequest, "zone price must not be negative", nil)
		}
		if item.Seats > 0 && len(item.SeatItems) > item.Seats {
			return apiError(c, fiber.StatusBadRequest, "seat items exceed zone capacity", nil)
		}
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var concert models.Concert
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&concert, "concert_id = ?", concertID).Error; err != nil {
			return err
		}
		if err := clearLayoutRecords(tx, concertID); err != nil {
			return err
		}

		for _, item := range payload.Zones {
			zoneID := item.ID
			if zoneID == "" {
				zoneID = uuid.NewString()
			}
			capacity := item.Seats
			if capacity == 0 {
				capacity = len(item.SeatItems)
			}
			zone := models.Zone{
				ZoneID: zoneID, ConcertID: concertID, ZoneType: item.Type, Capacity: capacity,
				Shape: item.Shape, Color: item.Color, PositionX: item.X, PositionY: item.Y,
				Width: item.Width, Height: item.Height, Rotation: item.Rotation, LayerOrder: int(item.Layer),
			}
			if zone.ZoneType == "" {
				zone.ZoneType = item.Name
			}
			if err := tx.Create(&zone).Error; err != nil {
				return err
			}
			for _, seatItem := range item.SeatItems {
				seatID := seatItem.ID
				if seatID == "" {
					seatID = uuid.NewString()
				}
				seatRow, seatColumn := splitSeatName(seatItem.Name)
				status := "AVAILABLE"
				if seatItem.Disabled {
					status = "DISABLED"
				}
				seat := models.Seat{
					SeatID: seatID, ZoneID: zoneID, ConcertID: concertID, SeatRow: seatRow,
					SeatColumn: seatColumn, StatusSeat: status, PositionX: seatItem.X, PositionY: seatItem.Y,
				}
				if err := tx.Create(&seat).Error; err != nil {
					return err
				}
			}
		}

		for _, item := range payload.LayoutObjects {
			objectID := item.ID
			if objectID == "" {
				objectID = uuid.NewString()
			}
			objectData, err := marshalJSONString(venueObjectData{Kind: item.Kind, Shape: item.Shape, Name: item.Name, ImageSrc: item.ImageSrc, AspectRatio: item.AspectRatio})
			if err != nil {
				return err
			}
			styleJSON, err := marshalJSONString(venueObjectStyle{Color: item.Color, TextColor: item.TextColor, FontSize: item.FontSize})
			if err != nil {
				return err
			}
			object := models.LayoutObject{
				ObjectID: objectID, ConcertID: concertID, LayoutType: "VENUE", ObjectType: item.Kind,
				PositionX: item.X, PositionY: item.Y, Width: item.Width, Height: item.Height,
				Rotation: item.Rotation, LayerOrder: int(item.Layer), ObjectData: objectData, StyleJSON: styleJSON,
			}
			if err := tx.Create(&object).Error; err != nil {
				return err
			}
		}
		if payload.TicketLayoutObjects != nil {
			if err := tx.Where("concert_id = ? AND layout_type = ?", concertID, "TICKET").Delete(&models.LayoutObject{}).Error; err != nil {
				return err
			}
			for _, item := range payload.TicketLayoutObjects {
				objectID := item.ID
				if objectID == "" {
					objectID = uuid.NewString()
				}
				objectData, err := marshalJSONString(venueObjectData{Kind: item.Kind, Shape: item.Shape, Name: item.Name, ImageSrc: item.ImageSrc, AspectRatio: item.AspectRatio})
				if err != nil {
					return err
				}
				styleJSON, err := marshalJSONString(venueObjectStyle{Color: item.Color, TextColor: item.TextColor, FontSize: item.FontSize})
				if err != nil {
					return err
				}
				object := models.LayoutObject{
					ObjectID: objectID, ConcertID: concertID, LayoutType: "TICKET", SideType: optionalString(item.Side), ObjectType: item.Kind,
					PositionX: item.X, PositionY: item.Y, Width: item.Width, Height: item.Height,
					Rotation: item.Rotation, LayerOrder: int(item.Layer), ObjectData: objectData, StyleJSON: styleJSON,
				}
				if err := tx.Create(&object).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "concert not found", err)
		}
		return apiError(c, fiber.StatusInternalServerError, "save layout", err)
	}
	if payload.Zones == nil {
		payload.Zones = []zoneDTO{}
	}
	for i := range payload.Zones {
		if payload.Zones[i].SeatItems == nil {
			payload.Zones[i].SeatItems = []seatDTO{}
		}
	}
	if payload.LayoutObjects == nil {
		payload.LayoutObjects = []layoutObjectDTO{}
	}
	if payload.TicketLayoutObjects == nil {
		payload.TicketLayoutObjects = []layoutObjectDTO{}
	}
	return c.JSON(payload)
}

func (h *VenueSeatHandler) clearLayout(c *fiber.Ctx) error {
	concertID := c.Params("id")
	if err := h.ensureConcert(concertID); err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error { return clearLayoutRecords(tx, concertID) }); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "clear layout", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func clearLayoutRecords(tx *gorm.DB, concertID string) error {
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.Seat{}).Error; err != nil {
		return err
	}
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.Zone{}).Error; err != nil {
		return err
	}
	return tx.Where("concert_id = ? AND layout_type = ?", concertID, "VENUE").Delete(&models.LayoutObject{}).Error
}

type venueObjectData struct {
	Kind        string  `json:"kind"`
	Shape       string  `json:"shape"`
	Name        string  `json:"name"`
	ImageSrc    string  `json:"imageSrc,omitempty"`
	AspectRatio float64 `json:"aspectRatio,omitempty"`
}

type venueObjectStyle struct {
	Color     string  `json:"color"`
	TextColor string  `json:"textColor"`
	FontSize  float64 `json:"fontSize,omitempty"`
}

func (h *VenueSeatHandler) ensureConcert(concertID string) error {
	var count int64
	if err := h.db.Model(&models.Concert{}).Where("concert_id = ?", concertID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (h *VenueSeatHandler) buildConcertDTO(concert models.Concert) (concertPlanDTO, error) {
	result := concertPlanDTO{
		ID: concert.ConcertID, Name: concert.ConcertName, Date: concert.StartDate,
		EndDate: concert.EndDate, Location: concert.Location, Status: concert.Status,
		Description: concert.MoreInfo, Cover: string(concert.Poster), Rounds: []roundDTO{},
		Publishing: publishingDTO{}, Zones: []zoneDTO{}, LayoutObjects: []layoutObjectDTO{}, TicketLayoutObjects: []layoutObjectDTO{},
	}
	if len(concert.SeatLayoutImage) > 0 {
		result.SeatLayoutImageURL = "/api/venue-seat/concerts/" + concert.ConcertID + "/seat-layout-image"
	}

	var rounds []models.PerformanceSchedule
	if err := h.db.Order("show_date, performance_order").Find(&rounds, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return result, err
	}
	for _, item := range rounds {
		result.Rounds = append(result.Rounds, roundDTO{ID: item.ScheduleID, Name: item.Details, Date: item.ShowDate, DoorTime: item.StartShow})
	}

	var publication models.Publication
	if err := h.db.First(&publication, "concert_id = ?", concert.ConcertID).Error; err == nil {
		result.Publishing = publishingDTO{
			ScheduleImage: publication.PosterWeb, Description: publication.Description,
			SaleStart: formatOptionalDateTime(publication.SaleOpenDate), SaleEnd: formatOptionalDateTime(publication.BookingCloseDatetime),
			PublishAt: formatOptionalDateTime(publication.OpenInWeb), UnpublishAt: formatOptionalDateTime(publication.OutWeb),
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}

	var zones []models.Zone
	if err := h.db.Order("layer_order").Find(&zones, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return result, err
	}
	for _, item := range zones {
		zone := zoneDTO{ID: item.ZoneID, Kind: "zone", Color: item.Color, Seats: item.Capacity, Type: item.ZoneType, Shape: item.Shape, X: item.PositionX, Y: item.PositionY, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: int64(item.LayerOrder), SeatItems: []seatDTO{}}
		price, err := loadZoneStartingPrice(h.db, item.ZoneID)
		if err != nil {
			return result, err
		}
		zone.Price = price
		if zone.Name == "" {
			zone.Name = item.ZoneType
		}
		var seats []models.Seat
		if err := h.db.Find(&seats, "zone_id = ?", item.ZoneID).Error; err != nil {
			return result, err
		}
		for _, seat := range seats {
			zone.SeatItems = append(zone.SeatItems, seatDTO{ID: seat.SeatID, Name: seatName(seat), X: seat.PositionX, Y: seat.PositionY, Disabled: strings.EqualFold(seat.StatusSeat, "DISABLED")})
		}
		result.Zones = append(result.Zones, zone)
	}

	var objects []models.LayoutObject
	if err := h.db.Order("layer_order").Find(&objects, "concert_id = ? AND layout_type = ?", concert.ConcertID, "VENUE").Error; err != nil {
		return result, err
	}
	for _, item := range objects {
		var data venueObjectData
		var style venueObjectStyle
		if item.ObjectData != nil {
			if err := json.Unmarshal([]byte(*item.ObjectData), &data); err != nil {
				return result, fmt.Errorf("decode layout object %s data: %w", item.ObjectID, err)
			}
		}
		if item.StyleJSON != nil {
			if err := json.Unmarshal([]byte(*item.StyleJSON), &style); err != nil {
				return result, fmt.Errorf("decode layout object %s style: %w", item.ObjectID, err)
			}
		}
		result.LayoutObjects = append(result.LayoutObjects, layoutObjectDTO{ID: item.ObjectID, Kind: data.Kind, Shape: data.Shape, Name: data.Name, Color: style.Color, TextColor: style.TextColor, X: item.PositionX, Y: item.PositionY, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: int64(item.LayerOrder), ImageSrc: data.ImageSrc, FontSize: style.FontSize, AspectRatio: data.AspectRatio})
	}
	var ticketObjects []models.LayoutObject
	if err := h.db.Order("layer_order").Find(&ticketObjects, "concert_id = ? AND layout_type = ?", concert.ConcertID, "TICKET").Error; err != nil {
		return result, err
	}
	for _, item := range ticketObjects {
		var data venueObjectData
		var style venueObjectStyle
		if item.ObjectData != nil {
			if err := json.Unmarshal([]byte(*item.ObjectData), &data); err != nil {
				return result, fmt.Errorf("decode ticket object %s data: %w", item.ObjectID, err)
			}
		}
		if item.StyleJSON != nil {
			if err := json.Unmarshal([]byte(*item.StyleJSON), &style); err != nil {
				return result, fmt.Errorf("decode ticket object %s style: %w", item.ObjectID, err)
			}
		}
		result.TicketLayoutObjects = append(result.TicketLayoutObjects, layoutObjectDTO{ID: item.ObjectID, Kind: data.Kind, Shape: data.Shape, Name: data.Name, Color: style.Color, TextColor: style.TextColor, X: item.PositionX, Y: item.PositionY, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: int64(item.LayerOrder), Side: valueOrEmpty(item.SideType), ImageSrc: data.ImageSrc, FontSize: style.FontSize, AspectRatio: data.AspectRatio})
	}
	return result, nil
}

func parseDate(value string) (time.Time, error) {
	return time.Parse("2006-01-02", value)
}

func formatDate(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02")
}

func parseOptionalDateTimeStrict(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	for _, layout := range []string{"2006-01-02T15:04", "2006-01-02T15:04:05", time.RFC3339} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed, nil
		}
	}
	return nil, fmt.Errorf("unsupported date-time %q", value)
}

func formatOptionalDateTime(value *time.Time) string {
	if value == nil {
		return ""
	}
	return value.Format("2006-01-02T15:04")
}

func normalizeClock(value string) string {
	if strings.TrimSpace(value) == "" {
		return "00:00:00"
	}
	if len(value) == 5 {
		return value + ":00"
	}
	return value
}

func optionalString(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func marshalJSONString(value any) (*string, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	result := string(encoded)
	return &result, nil
}

func splitSeatName(name string) (row, column string) {
	trimmed := strings.TrimSpace(name)
	for index, character := range trimmed {
		if unicode.IsDigit(character) {
			return trimmed[:index], trimmed[index:]
		}
	}
	return "", trimmed
}

func seatName(seat models.Seat) string {
	if seat.SeatRow == "" {
		return seat.SeatColumn
	}
	return seat.SeatRow + seat.SeatColumn
}

func apiError(c *fiber.Ctx, status int, message string, err error) error {
	payload := fiber.Map{"error": message}
	if err != nil {
		payload["detail"] = err.Error()
	}
	return c.Status(status).JSON(payload)
}
