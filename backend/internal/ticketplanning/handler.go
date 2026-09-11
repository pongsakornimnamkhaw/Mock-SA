package ticketplanning

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TicketPlanningHandler struct {
	db *gorm.DB
}

var (
	errLayoutHasIssuedTickets = errors.New("ไม่สามารถลบโซนหรือที่นั่งที่ออกบัตรแล้ว")
	errIssuedSeatImmutable    = errors.New("ไม่สามารถเปลี่ยนโซน แถว หรือเลขที่นั่งที่ออกบัตรแล้ว")
	errCapacityBelowIssued    = errors.New("ไม่สามารถลดความจุต่ำกว่าจำนวนบัตรที่ออกแล้ว")
	errSeatItemsOverCapacity  = errors.New("จำนวนที่นั่งมากกว่าความจุของโซน")
	errLayoutOwnership        = errors.New("ข้อมูลผังเป็นของคอนเสิร์ตอื่น")
)

const maxLayerOrder = int64(1<<31 - 1)

func RegisterRoutes(app *fiber.App, db *gorm.DB) {
	handler := &TicketPlanningHandler{db: db}
	group := app.Group("/api/ticket-planning")
	group.Get("/concerts", handler.listConcerts)
	group.Get("/concerts/:id", handler.getConcert)
	group.Post("/concerts", handler.createConcert)
	group.Put("/concerts/:id", handler.updateConcert)
	group.Put("/concerts/:id/layout", handler.saveLayout)
	group.Get("/concerts/:id/layout", handler.getLayout)
	group.Get("/concerts/:id/publication", handler.getPublication)
	group.Put("/concerts/:id/publication", handler.putPublication)
	group.Get("/concerts/:id/ticket-design", handler.getTicketDesign)
	group.Put("/concerts/:id/ticket-design", handler.putTicketDesign)
	group.Get("/concerts/:id/seat-layout-image", handler.getSeatLayoutImage)
	group.Put("/concerts/:id/seat-layout-image", handler.storeSeatLayoutImage)
	group.Get("/tickets/:ticketID/image", handler.getTicketImage)
	group.Put("/tickets/:ticketID/image", handler.storeTicketImage)
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
	ID        uint    `json:"id,omitempty"`
	ClientKey string  `json:"clientKey,omitempty"`
	Name      string  `json:"name"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Rotation  float64 `json:"rotation,omitempty"`
	Disabled  bool    `json:"disabled"`
}

type zoneDTO struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	Seats     int       `json:"seats"`
	SeatItems []seatDTO `json:"seatItems"`
	ZonePrice float64   `json:"zonePrice"`
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

type ticketDesignDTO struct {
	Objects []layoutObjectDTO `json:"objects"`
}

func (h *TicketPlanningHandler) getLayout(c *fiber.Ctx) error {
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", c.Params("id")).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	result, err := h.buildConcertDTO(concert)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load layout", err)
	}
	return c.JSON(layoutDTO{Zones: result.Zones, LayoutObjects: result.LayoutObjects, TicketLayoutObjects: result.TicketLayoutObjects})
}

func (h *TicketPlanningHandler) getPublication(c *fiber.Ctx) error {
	var publication models.Publication
	if err := h.db.First(&publication, "concert_id = ?", c.Params("id")).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(publishingDTO{})
		}
		return apiError(c, fiber.StatusInternalServerError, "load publication", err)
	}
	return c.JSON(publicationDTO(publication))
}

func (h *TicketPlanningHandler) putPublication(c *fiber.Ctx) error {
	concertID := strings.TrimSpace(c.Params("id"))
	if err := h.ensureConcert(concertID); err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	var payload publishingDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid publication body", err)
	}
	saleStart, err := parseOptionalDateTimeStrict(payload.SaleStart)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid sale start", err)
	}
	saleEnd, err := parseOptionalDateTimeStrict(payload.SaleEnd)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid sale end", err)
	}
	publishAt, err := parseOptionalDateTimeStrict(payload.PublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid publish date", err)
	}
	unpublishAt, err := parseOptionalDateTimeStrict(payload.UnpublishAt)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid unpublish date", err)
	}
	if saleStart != nil && saleEnd != nil && saleEnd.Before(*saleStart) {
		return apiError(c, fiber.StatusBadRequest, "sale end must not be before sale start", nil)
	}
	publication := models.Publication{
		PublicationID: "publication-" + concertID, ConcertID: concertID,
		SaleOpenDate: saleStart, BookingCloseDatetime: saleEnd, OpenInWeb: publishAt,
		OutWeb: unpublishAt, Description: payload.Description, PosterWeb: []byte(payload.ScheduleImage),
	}
	if err := h.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "concert_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"sale_open_date", "booking_close_datetime", "open_in_web", "out_web", "description", "poster_web", "updated_at"}),
	}).Create(&publication).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "save publication", err)
	}
	return c.JSON(publicationDTO(publication))
}

func publicationDTO(publication models.Publication) publishingDTO {
	return publishingDTO{
		ScheduleImage: string(publication.PosterWeb), Description: publication.Description,
		SaleStart: formatOptionalDateTime(publication.SaleOpenDate), SaleEnd: formatOptionalDateTime(publication.BookingCloseDatetime),
		PublishAt: formatOptionalDateTime(publication.OpenInWeb), UnpublishAt: formatOptionalDateTime(publication.OutWeb),
	}
}

func (h *TicketPlanningHandler) getTicketDesign(c *fiber.Ctx) error {
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", c.Params("id")).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	result, err := h.buildConcertDTO(concert)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "load ticket design", err)
	}
	return c.JSON(ticketDesignDTO{Objects: result.TicketLayoutObjects})
}

func (h *TicketPlanningHandler) putTicketDesign(c *fiber.Ctx) error {
	concertID := strings.TrimSpace(c.Params("id"))
	if err := h.ensureConcert(concertID); err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	var payload ticketDesignDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid ticket design body", err)
	}
	for _, item := range payload.Objects {
		if item.Layer < 0 || item.Layer > maxLayerOrder {
			return apiError(c, fiber.StatusBadRequest, "ticket layer order is out of range", nil)
		}
	}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("concert_id = ? AND layout_type = ?", concertID, "TICKET").Delete(&models.LayoutObject{}).Error; err != nil {
			return err
		}
		for _, item := range payload.Objects {
			objectData, err := marshalJSONString(venueObjectData{Kind: item.Kind, Shape: item.Shape, Name: item.Name, ImageSrc: item.ImageSrc, AspectRatio: item.AspectRatio})
			if err != nil {
				return err
			}
			styleJSON, err := marshalJSONString(venueObjectStyle{Color: item.Color, TextColor: item.TextColor, FontSize: item.FontSize})
			if err != nil {
				return err
			}
			objectID := item.ID
			if objectID == "" {
				objectID = uuid.NewString()
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
		return nil
	})
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "save ticket design", err)
	}
	return c.JSON(payload)
}

func (h *TicketPlanningHandler) storeTicketImage(c *fiber.Ctx) error {
	if !isPNGRequest(c) || len(c.Body()) == 0 {
		return apiError(c, fiber.StatusBadRequest, "a non-empty image/png body is required", nil)
	}
	ticketID, err := parseNumericID(c.Params("ticketID"))
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

func (h *TicketPlanningHandler) getTicketImage(c *fiber.Ctx) error {
	ticketID, parseErr := parseNumericID(c.Params("ticketID"))
	if parseErr != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid ticket id", parseErr)
	}
	var ticket models.Ticket
	if err := h.db.Select("ticket_id", "image_ticket").First(&ticket, "ticket_id = ?", ticketID).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "ticket image not found", err)
	}
	if len(ticket.ImageTicket) == 0 {
		return apiError(c, fiber.StatusNotFound, "ticket image not found", nil)
	}
	c.Set(fiber.HeaderContentType, "image/png")
	return c.Send(ticket.ImageTicket)
}

func (h *TicketPlanningHandler) listConcerts(c *fiber.Ctx) error {
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

func (h *TicketPlanningHandler) getConcert(c *fiber.Ctx) error {
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

func (h *TicketPlanningHandler) storeSeatLayoutImage(c *fiber.Ctx) error {
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

func (h *TicketPlanningHandler) getSeatLayoutImage(c *fiber.Ctx) error {
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

func (h *TicketPlanningHandler) createConcert(c *fiber.Ctx) error {
	var payload concertPlanDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	if payload.ID == "" {
		payload.ID = uuid.NewString()
	}
	return h.persistConcert(c, payload.ID, payload)
}

func (h *TicketPlanningHandler) updateConcert(c *fiber.Ctx) error {
	var payload concertPlanDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid request body", err)
	}
	return h.persistConcert(c, c.Params("id"), payload)
}

func (h *TicketPlanningHandler) persistConcert(c *fiber.Ctx, concertID string, payload concertPlanDTO) error {
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
	posterBytes, err := decodeConcertCover(payload.Cover)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid concert cover", err)
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
		concert.Poster = posterBytes
		concert.ConcertPoster = posterBytes

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
			"poster":         posterBytes,
			"concert_poster": posterBytes,
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
			PosterWeb:            []byte(payload.Publishing.ScheduleImage),
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

func (h *TicketPlanningHandler) saveLayout(c *fiber.Ctx) error {
	concertID := c.Params("id")
	var payload layoutDTO
	if err := c.BodyParser(&payload); err != nil {
		return apiError(c, fiber.StatusBadRequest, "invalid layout body", err)
	}
	for _, item := range payload.Zones {
		if item.Seats < 0 {
			return apiError(c, fiber.StatusBadRequest, "zone capacity must not be negative", nil)
		}
		if item.ZonePrice < 0 {
			return apiError(c, fiber.StatusBadRequest, "zone price must not be negative", nil)
		}
		if item.Layer < 0 || item.Layer > maxLayerOrder {
			return apiError(c, fiber.StatusBadRequest, "zone layer order is out of range", nil)
		}
	}
	for _, item := range payload.LayoutObjects {
		if item.Layer < 0 || item.Layer > maxLayerOrder {
			return apiError(c, fiber.StatusBadRequest, "object layer order is out of range", nil)
		}
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		var concert models.Concert
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&concert, "concert_id = ?", concertID).Error; err != nil {
			return err
		}
		if err := syncPlanningZones(tx, concertID, payload.Zones); err != nil {
			return err
		}
		if err := tx.Where("concert_id = ? AND layout_type = ?", concertID, "VENUE").Delete(&models.LayoutObject{}).Error; err != nil {
			return err
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
		return nil
	})
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apiError(c, fiber.StatusNotFound, "concert not found", err)
		}
		if errors.Is(err, errLayoutHasIssuedTickets) || errors.Is(err, errIssuedSeatImmutable) || errors.Is(err, errCapacityBelowIssued) || errors.Is(err, errLayoutOwnership) {
			return apiError(c, fiber.StatusConflict, err.Error(), nil)
		}
		if errors.Is(err, errSeatItemsOverCapacity) {
			return apiError(c, fiber.StatusBadRequest, err.Error(), nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "save layout", err)
	}
	var saved models.Concert
	if err := h.db.First(&saved, "concert_id = ?", concertID).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload layout", err)
	}
	result, err := h.buildConcertDTO(saved)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "reload layout", err)
	}
	return c.JSON(layoutDTO{Zones: result.Zones, LayoutObjects: result.LayoutObjects, TicketLayoutObjects: result.TicketLayoutObjects})
}

func (h *TicketPlanningHandler) clearLayout(c *fiber.Ctx) error {
	concertID := c.Params("id")
	if err := h.ensureConcert(concertID); err != nil {
		return apiError(c, fiber.StatusNotFound, "concert not found", err)
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error { return clearLayoutRecords(tx, concertID) }); err != nil {
		if errors.Is(err, errLayoutHasIssuedTickets) {
			return apiError(c, fiber.StatusConflict, err.Error(), nil)
		}
		return apiError(c, fiber.StatusInternalServerError, "clear layout", err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func clearLayoutRecords(tx *gorm.DB, concertID string) error {
	var zoneIDs []string
	if err := tx.Model(&models.Zone{}).Where("concert_id = ?", concertID).Pluck("zone_id", &zoneIDs).Error; err != nil {
		return err
	}
	if len(zoneIDs) > 0 {
		var seatIDs []uint
		if err := tx.Model(&models.Seat{}).Where("zone_id IN ?", zoneIDs).Pluck("seat_id", &seatIDs).Error; err != nil {
			return err
		}
		if err := ensureSeatsHaveNoTickets(tx, seatIDs); err != nil {
			return err
		}
		if err := tx.Where("zone_id IN ?", zoneIDs).Delete(&models.Seat{}).Error; err != nil {
			return err
		}
		if err := tx.Where("zone_id IN ?", zoneIDs).Delete(&models.Zone{}).Error; err != nil {
			return err
		}
	}
	return tx.Where("concert_id = ? AND layout_type = ?", concertID, "VENUE").Delete(&models.LayoutObject{}).Error
}

func syncPlanningZones(tx *gorm.DB, concertID string, items []zoneDTO) error {
	var existing []models.Zone
	if err := tx.Where("concert_id = ?", concertID).Find(&existing).Error; err != nil {
		return err
	}
	incoming := make(map[string]struct{}, len(items))
	for index := range items {
		if strings.TrimSpace(items[index].ID) == "" {
			items[index].ID = uuid.NewString()
		}
		incoming[items[index].ID] = struct{}{}
	}
	for _, zone := range existing {
		if _, keep := incoming[zone.ZoneID]; keep {
			continue
		}
		var seatIDs []uint
		if err := tx.Model(&models.Seat{}).Where("zone_id = ?", zone.ZoneID).Pluck("seat_id", &seatIDs).Error; err != nil {
			return err
		}
		if err := ensureSeatsHaveNoTickets(tx, seatIDs); err != nil {
			return err
		}
		if err := tx.Where("zone_id = ?", zone.ZoneID).Delete(&models.Seat{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.Zone{}, "zone_id = ?", zone.ZoneID).Error; err != nil {
			return err
		}
	}

	for _, item := range items {
		var conflictCount int64
		if err := tx.Model(&models.Zone{}).Where("zone_id = ? AND concert_id <> ?", item.ID, concertID).Count(&conflictCount).Error; err != nil {
			return err
		}
		if conflictCount > 0 {
			return errLayoutOwnership
		}
		var issuedCount int64
		if err := tx.Model(&models.Ticket{}).
			Joins("JOIN seats ON seats.seat_id = tickets.seat_id").
			Where("seats.zone_id = ?", item.ID).
			Count(&issuedCount).Error; err != nil {
			return err
		}
		if int64(item.Seats) < issuedCount {
			return errCapacityBelowIssued
		}
		if len(item.SeatItems) > item.Seats {
			return errSeatItemsOverCapacity
		}
		zoneName := strings.TrimSpace(item.Name)
		if zoneName == "" {
			zoneName = strings.TrimSpace(item.Type)
		}
		zone := models.Zone{
			ZoneID: item.ID, ConcertID: concertID, ZoneType: zoneName, Capacity: item.Seats, ZonePrice: item.ZonePrice,
			Shape: item.Shape, Color: item.Color, PositionX: item.X, PositionY: item.Y,
			Width: item.Width, Height: item.Height, Rotation: item.Rotation, LayerOrder: int(item.Layer),
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "zone_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"concert_id", "zone_type", "capacity", "zone_price", "shape", "color", "position_x", "position_y", "width", "height", "rotation", "layer_order"}),
		}).Create(&zone).Error; err != nil {
			return err
		}
		if err := syncPlanningSeats(tx, concertID, item.ID, item.SeatItems); err != nil {
			return err
		}
	}
	return nil
}

func syncPlanningSeats(tx *gorm.DB, concertID, zoneID string, items []seatDTO) error {
	var existing []models.Seat
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("zone_id = ?", zoneID).Find(&existing).Error; err != nil {
		return err
	}
	existingByID := make(map[uint]models.Seat, len(existing))
	existingIDs := make([]uint, 0, len(existing))
	for _, seat := range existing {
		existingByID[seat.SeatID] = seat
		existingIDs = append(existingIDs, seat.SeatID)
	}
	issued := make(map[uint]bool, len(existing))
	if len(existingIDs) > 0 {
		var issuedIDs []uint
		if err := tx.Model(&models.Ticket{}).Where("seat_id IN ?", existingIDs).Pluck("seat_id", &issuedIDs).Error; err != nil {
			return err
		}
		for _, seatID := range issuedIDs {
			issued[seatID] = true
		}
	}
	incoming := make(map[uint]struct{}, len(items))
	for _, item := range items {
		if item.ID > 0 {
			incoming[item.ID] = struct{}{}
		}
	}
	for _, seat := range existing {
		if _, keep := incoming[seat.SeatID]; keep {
			continue
		}
		if err := ensureSeatsHaveNoTickets(tx, []uint{seat.SeatID}); err != nil {
			return err
		}
		if err := tx.Delete(&models.Seat{}, "seat_id = ?", seat.SeatID).Error; err != nil {
			return err
		}
	}
	for index, item := range items {
		if item.ID == 0 {
			seat := models.Seat{
				ZoneID: zoneID, SeatLabel: item.Name, SeatRow: 1, SeatColumn: index + 1,
				StatusSeat: layoutSeatStatus(item.Disabled, "", false), PositionX: item.X,
				PositionY: item.Y, Rotation: item.Rotation,
			}
			if err := tx.Create(&seat).Error; err != nil {
				return err
			}
			continue
		}

		current, exists := existingByID[item.ID]
		if !exists {
			var conflictCount int64
			if err := tx.Model(&models.Seat{}).Where("seat_id = ?", item.ID).Count(&conflictCount).Error; err != nil {
				return err
			}
			if conflictCount > 0 {
				return errLayoutOwnership
			}
			return errLayoutOwnership
		}
		if issued[item.ID] && strings.TrimSpace(current.SeatLabel) != strings.TrimSpace(item.Name) {
			return errIssuedSeatImmutable
		}
		updates := map[string]any{
			"status_seat": layoutSeatStatus(item.Disabled, current.StatusSeat, issued[item.ID]),
			"position_x":  item.X, "position_y": item.Y, "rotation": item.Rotation,
		}
		if !issued[item.ID] {
			updates["seat_label"] = item.Name
			updates["seat_row"] = 1
			updates["seat_column"] = index + 1
		}
		if err := tx.Model(&models.Seat{}).Where("seat_id = ? AND zone_id = ?", item.ID, zoneID).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}

func layoutSeatStatus(disabled bool, existingStatus string, issued bool) string {
	if issued && strings.TrimSpace(existingStatus) != "" {
		return existingStatus
	}
	if disabled {
		return "DISABLED"
	}
	return "AVAILABLE"
}

func ensureSeatsHaveNoTickets(tx *gorm.DB, seatIDs []uint) error {
	if len(seatIDs) == 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&models.Ticket{}).Where("seat_id IN ?", seatIDs).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return errLayoutHasIssuedTickets
	}
	return nil
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

func (h *TicketPlanningHandler) ensureConcert(concertID string) error {
	var count int64
	if err := h.db.Model(&models.Concert{}).Where("concert_id = ?", concertID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (h *TicketPlanningHandler) buildConcertDTO(concert models.Concert) (concertPlanDTO, error) {
	poster := concert.Poster
	if len(poster) == 0 {
		poster = concert.ConcertPoster
	}
	result := concertPlanDTO{
		ID: concert.ConcertID, Name: concert.ConcertName, Date: concert.StartDate,
		EndDate: concert.EndDate, Location: concert.Location, Status: concert.Status,
		Description: concert.MoreInfo, Cover: encodeConcertCover(poster), Rounds: []roundDTO{},
		Publishing: publishingDTO{}, Zones: []zoneDTO{}, LayoutObjects: []layoutObjectDTO{}, TicketLayoutObjects: []layoutObjectDTO{},
	}
	if len(concert.SeatLayoutImage) > 0 {
		result.SeatLayoutImageURL = "/api/ticket-planning/concerts/" + concert.ConcertID + "/seat-layout-image"
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
			ScheduleImage: string(publication.PosterWeb), Description: publication.Description,
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
		zone := zoneDTO{ID: item.ZoneID, Kind: "zone", Color: item.Color, Seats: item.Capacity, ZonePrice: item.ZonePrice, Type: item.ZoneType, Shape: item.Shape, X: item.PositionX, Y: item.PositionY, Width: item.Width, Height: item.Height, Rotation: item.Rotation, Layer: int64(item.LayerOrder), SeatItems: []seatDTO{}}
		if zone.Name == "" {
			zone.Name = item.ZoneType
		}
		var seats []models.Seat
		if err := h.db.Find(&seats, "zone_id = ?", item.ZoneID).Error; err != nil {
			return result, err
		}
		for _, seat := range seats {
			zone.SeatItems = append(zone.SeatItems, seatDTO{ID: seat.SeatID, ClientKey: fmt.Sprintf("seat-%d", seat.SeatID), Name: seatName(seat), X: seat.PositionX, Y: seat.PositionY, Rotation: seat.Rotation, Disabled: strings.EqualFold(seat.StatusSeat, "DISABLED")})
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

func decodeConcertCover(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	if !strings.HasPrefix(value, "data:") {
		return []byte(value), nil
	}
	comma := strings.IndexByte(value, ',')
	if comma < 0 || !strings.Contains(value[:comma], ";base64") {
		return nil, errors.New("cover must be a base64 data URL")
	}
	decoded, err := base64.StdEncoding.DecodeString(value[comma+1:])
	if err != nil {
		return nil, fmt.Errorf("decode cover: %w", err)
	}
	return decoded, nil
}

func encodeConcertCover(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	if strings.HasPrefix(string(data), "data:image/") {
		return string(data)
	}
	mime := "image/jpeg"
	if len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n" {
		mime = "image/png"
	} else if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		mime = "image/webp"
	} else if len(data) >= 6 && (string(data[:6]) == "GIF87a" || string(data[:6]) == "GIF89a") {
		mime = "image/gif"
	} else {
		trimmed := bytes.TrimSpace(data)
		if bytes.HasPrefix(trimmed, []byte("<svg")) || (bytes.HasPrefix(trimmed, []byte("<?xml")) && bytes.Contains(trimmed, []byte("<svg"))) {
			mime = "image/svg+xml"
		}
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
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
	if strings.TrimSpace(seat.SeatLabel) != "" {
		return seat.SeatLabel
	}
	return fmt.Sprintf("%d-%d", seat.SeatRow, seat.SeatColumn)
}

func isPNGRequest(c *fiber.Ctx) bool {
	return strings.EqualFold(strings.TrimSpace(strings.Split(c.Get(fiber.HeaderContentType), ";")[0]), "image/png")
}

func parseNumericID(value string) (uint, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil || parsed == 0 {
		return 0, fmt.Errorf("invalid numeric id %q", value)
	}
	return uint(parsed), nil
}

func apiError(c *fiber.Ctx, status int, message string, err error) error {
	payload := fiber.Map{"error": message}
	if err != nil {
		payload["detail"] = err.Error()
	}
	return c.Status(status).JSON(payload)
}
