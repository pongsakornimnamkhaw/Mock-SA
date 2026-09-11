package handlers

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/internal/access"
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
	view := requireEmployeeModule(db, access.Venues, access.View)
	edit := requireEmployeeModule(db, access.Venues, access.Edit)
	group.Get("/concerts", view, handler.listConcerts)
	group.Get("/concerts/:id", view, handler.getConcert)
	group.Post("/concerts", edit, handler.createConcert)
	group.Put("/concerts/:id", edit, handler.updateConcert)
	group.Put("/concerts/:id/layout", edit, handler.saveLayout)
	group.Delete("/concerts/:id/layout", edit, handler.clearLayout)
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
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Artist        string            `json:"artist"`
	Date          string            `json:"date"`
	EndDate       string            `json:"endDate"`
	Location      string            `json:"location"`
	Category      string            `json:"category"`
	Status        string            `json:"status"`
	Description   string            `json:"description"`
	Cover         string            `json:"cover"`
	Rounds        []roundDTO        `json:"rounds"`
	Publishing    publishingDTO     `json:"publishing"`
	Zones         []zoneDTO         `json:"zones"`
	LayoutObjects []layoutObjectDTO `json:"layoutObjects"`
}

type layoutDTO struct {
	Zones         []zoneDTO         `json:"zones"`
	LayoutObjects []layoutObjectDTO `json:"layoutObjects"`
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

		plan := models.VenueSeatPlan{
			LayoutID:      "layout-" + concertID,
			ConcertID:     concertID,
			Category:      payload.Category,
			ArtistDisplay: payload.Artist,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "concert_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"category", "artist_display", "updated_at"}),
		}).Create(&plan).Error; err != nil {
			return err
		}

		if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueSeatRound{}).Error; err != nil {
			return err
		}
		for _, item := range payload.Rounds {
			showDate, err := parseDate(item.Date)
			if err != nil {
				return fmt.Errorf("round %q date: %w", item.Name, err)
			}
			roundID := item.ID
			if roundID == "" {
				roundID = uuid.NewString()
			}
			round := models.VenueSeatRound{RoundID: roundID, ConcertID: concertID, Name: item.Name, ShowDate: showDate, DoorTime: item.DoorTime, Status: item.Status}
			if err := tx.Create(&round).Error; err != nil {
				return err
			}
		}

		publication := models.VenueSeatPublication{
			PublicationID: "publication-" + concertID,
			ConcertID:     concertID,
			ScheduleFile:  payload.Publishing.ScheduleFile,
			ScheduleImage: []byte(payload.Publishing.ScheduleImage),
			SaleStart:     parseOptionalDateTime(payload.Publishing.SaleStart),
			SaleEnd:       parseOptionalDateTime(payload.Publishing.SaleEnd),
			PublishAt:     parseOptionalDateTime(payload.Publishing.PublishAt),
			UnpublishAt:   parseOptionalDateTime(payload.Publishing.UnpublishAt),
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "concert_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"schedule_file", "schedule_image", "sale_start", "sale_end", "publish_at", "unpublish_at",
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
	if err := h.ensureConcert(concertID); err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := clearLayoutRecords(tx, concertID); err != nil {
			return err
		}

		plan := models.VenueSeatPlan{LayoutID: "layout-" + concertID, ConcertID: concertID}
		if err := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "concert_id"}}, DoNothing: true}).Create(&plan).Error; err != nil {
			return err
		}

		for _, item := range payload.Zones {
			zoneID := item.ID
			if zoneID == "" {
				zoneID = uuid.NewString()
			}
			zone := models.VenueSeatZone{
				ZoneID: zoneID, ConcertID: concertID, Name: item.Name, Color: item.Color,
				SeatCount: len(item.SeatItems), Price: item.Price, ZoneType: item.Type,
				Shape: item.Shape, X: item.X, Y: item.Y, Width: item.Width, Height: item.Height,
				Rotation: item.Rotation, Layer: item.Layer,
			}
			if zone.SeatCount == 0 {
				zone.SeatCount = item.Seats
			}
			if err := tx.Create(&zone).Error; err != nil {
				return err
			}
			for _, seatItem := range item.SeatItems {
				seatID := seatItem.ID
				if seatID == "" {
					seatID = uuid.NewString()
				}
				seat := models.VenueSeat{SeatID: seatID, ZoneID: zoneID, Name: seatItem.Name, X: seatItem.X, Y: seatItem.Y, Disabled: seatItem.Disabled}
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
			object := models.VenueLayoutObject{
				ObjectID: objectID, ConcertID: concertID, Kind: item.Kind, Shape: item.Shape,
				Name: item.Name, Color: item.Color, TextColor: item.TextColor,
				X: item.X, Y: item.Y, Width: item.Width, Height: item.Height,
				Rotation: item.Rotation, Layer: item.Layer,
			}
			if err := tx.Create(&object).Error; err != nil {
				return err
			}
		}
		return applyTicketingProjection(tx, concertID, payload.Zones)
	})
	if err != nil {
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
	var zones []models.VenueSeatZone
	if err := tx.Where("concert_id = ?", concertID).Find(&zones).Error; err != nil {
		return err
	}
	zoneIDs := make([]string, 0, len(zones))
	for _, zone := range zones {
		zoneIDs = append(zoneIDs, zone.ZoneID)
	}
	if len(zoneIDs) > 0 {
		if err := tx.Where("zone_id IN ?", zoneIDs).Delete(&models.VenueSeat{}).Error; err != nil {
			return err
		}
	}
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueSeatZone{}).Error; err != nil {
		return err
	}
	if err := tx.Where("concert_id = ?", concertID).Delete(&models.VenueLayoutObject{}).Error; err != nil {
		return err
	}
	return clearTicketingProjection(tx, concertID, zoneIDs)
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
		Publishing: publishingDTO{}, Zones: []zoneDTO{}, LayoutObjects: []layoutObjectDTO{},
	}

	var plan models.VenueSeatPlan
	if err := h.db.First(&plan, "concert_id = ?", concert.ConcertID).Error; err == nil {
		result.Category = plan.Category
		result.Artist = plan.ArtistDisplay
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}

	var rounds []models.VenueSeatRound
	if err := h.db.Order("show_date, door_time").Find(&rounds, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return result, err
	}
	for _, item := range rounds {
		result.Rounds = append(result.Rounds, roundDTO{ID: item.RoundID, Name: item.Name, Date: formatDate(item.ShowDate), DoorTime: item.DoorTime, Status: item.Status})
	}

	var publication models.VenueSeatPublication
	if err := h.db.First(&publication, "concert_id = ?", concert.ConcertID).Error; err == nil {
		result.Publishing = publishingDTO{
			ScheduleFile: publication.ScheduleFile, ScheduleImage: string(publication.ScheduleImage),
			SaleStart: formatOptionalDateTime(publication.SaleStart), SaleEnd: formatOptionalDateTime(publication.SaleEnd),
			PublishAt: formatOptionalDateTime(publication.PublishAt), UnpublishAt: formatOptionalDateTime(publication.UnpublishAt),
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}

	var zones []models.VenueSeatZone
	if err := h.db.Order("layer_order").Find(&zones, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return result, err
	}
	for _, item := range zones {
		zone := zoneDTO{ID: item.ZoneID, Kind: "zone", Name: item.Name, Color: item.Color, Seats: item.SeatCount, Price: item.Price, Type: item.ZoneType, Shape: item.Shape, X: item.X, Y: item.Y, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: item.Layer, SeatItems: []seatDTO{}}
		var seats []models.VenueSeat
		if err := h.db.Find(&seats, "zone_id = ?", item.ZoneID).Error; err != nil {
			return result, err
		}
		for _, seat := range seats {
			zone.SeatItems = append(zone.SeatItems, seatDTO{ID: seat.SeatID, Name: seat.Name, X: seat.X, Y: seat.Y, Disabled: seat.Disabled})
		}
		result.Zones = append(result.Zones, zone)
	}

	var objects []models.VenueLayoutObject
	if err := h.db.Order("layer_order").Find(&objects, "concert_id = ?", concert.ConcertID).Error; err != nil {
		return result, err
	}
	for _, item := range objects {
		result.LayoutObjects = append(result.LayoutObjects, layoutObjectDTO{ID: item.ObjectID, Kind: item.Kind, Shape: item.Shape, Name: item.Name, Color: item.Color, TextColor: item.TextColor, X: item.X, Y: item.Y, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: item.Layer})
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

func parseOptionalDateTime(value string) *time.Time {
	if value == "" {
		return nil
	}
	for _, layout := range []string{"2006-01-02T15:04", "2006-01-02T15:04:05", time.RFC3339} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed
		}
	}
	return nil
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
