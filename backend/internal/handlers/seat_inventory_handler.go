package handlers

import (
	"errors"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type seatInventoryHandler struct {
	db *gorm.DB
}

const (
	seatInventoryStatusHeld   = "HELD"
	seatInventoryStatusLocked = "LOCKED"
	seatHoldDuration          = 15 * time.Minute
)

func RegisterSeatInventoryRoutes(app *fiber.App, db *gorm.DB) {
	h := &seatInventoryHandler{db: db}
	app.Get("/api/concerts/:id/zones", h.listZones)
	app.Get("/api/concerts/:id/zones/:zoneId/seats", h.listSeats)
	app.Post("/api/seat-holds", h.createSeatHold)
	app.Delete("/api/seat-holds/:token", h.releaseSeatHold)
}

type zoneInventoryDTO struct {
	ZoneID       string  `json:"zone_id"`
	ZoneType     string  `json:"zone_type"`
	CategoryName string  `json:"category_name"`
	Color        string  `json:"color"`
	Price        float64 `json:"price"`
	Capacity     int     `json:"capacity"`
	Available    int     `json:"available"`
}

type seatInventoryDTO struct {
	SeatID     uint    `json:"seat_id"`
	Label      string  `json:"label"`
	SeatRow    int     `json:"seat_row"`
	SeatColumn int     `json:"seat_column"`
	Status     string  `json:"status"`
	PositionX  float64 `json:"position_x"`
	PositionY  float64 `json:"position_y"`
}

// listZones returns zones owned by this concert.
func (h *seatInventoryHandler) listZones(c *fiber.Ctx) error {
	concertID := c.Params("id")
	now := time.Now().UTC()

	var zones []models.Zone
	if err := h.db.Where("concert_id = ?", concertID).Order("zone_id").Find(&zones).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดโซนได้"})
	}

	result := make([]zoneInventoryDTO, 0, len(zones))
	for _, zone := range zones {
		var available int64
		h.db.Model(&models.Seat{}).
			Where("zone_id = ? AND status_seat IN ? AND (hold_expires_at IS NULL OR hold_expires_at <= ?)", zone.ZoneID, seatAvailableStatuses, now).
			Count(&available)

		var capacity int64
		h.db.Model(&models.Seat{}).
			Where("zone_id = ?", zone.ZoneID).
			Count(&capacity)

		result = append(result, zoneInventoryDTO{
			ZoneID:       zone.ZoneID,
			ZoneType:     zone.ZoneType,
			CategoryName: zone.ZoneType,
			Color:        zone.Color,
			Price:        zone.ZonePrice,
			Capacity:     int(capacity),
			Available:    int(available),
		})
	}

	return c.JSON(fiber.Map{"data": result})
}

// listSeats คืนที่นั่งจริงที่สร้างจากหน้าวางผัง โดย GET จะไม่สร้างข้อมูลใหม่
func (h *seatInventoryHandler) listSeats(c *fiber.Ctx) error {
	concertID := c.Params("id")
	zoneID := c.Params("zoneId")
	holdToken := strings.TrimSpace(c.Query("hold_token"))
	now := time.Now().UTC()

	var zone models.Zone
	if err := h.db.Where("zone_id = ? AND concert_id = ?", zoneID, concertID).First(&zone).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบโซนในคอนเสิร์ตนี้"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถตรวจสอบโซนได้"})
	}

	var seats []models.Seat
	if err := h.db.Joins("JOIN zones ON zones.zone_id = seats.zone_id").
		Where("zones.concert_id = ? AND seats.zone_id = ?", concertID, zoneID).
		Order("seats.seat_row, seats.seat_column").Find(&seats).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดที่นั่งได้"})
	}

	result := make([]seatInventoryDTO, 0, len(seats))
	for i := range seats {
		status := seats[i].StatusSeat
		if isSeatAvailable(status) {
			status = seatStatusAvailable
		}
		if status == seatStatusAvailable && seats[i].HoldToken != nil && seats[i].HoldExpiresAt != nil && seats[i].HoldExpiresAt.After(now) {
			if holdToken != "" && *seats[i].HoldToken == holdToken {
				status = seatInventoryStatusLocked
			} else {
				status = seatInventoryStatusHeld
			}
		}
		result = append(result, seatInventoryDTO{
			SeatID:     seats[i].SeatID,
			Label:      seats[i].Label(),
			SeatRow:    seats[i].SeatRow,
			SeatColumn: seats[i].SeatColumn,
			Status:     status,
			PositionX:  seats[i].PositionX,
			PositionY:  seats[i].PositionY,
		})
	}

	return c.JSON(fiber.Map{"data": result})
}

type createSeatHoldInput struct {
	ConcertID string `json:"concert_id"`
	ZoneID    string `json:"zone_id"`
	SeatIDs   []uint `json:"seat_ids"`
}

func (h *seatInventoryHandler) createSeatHold(c *fiber.Ctx) error {
	var input createSeatHoldInput
	if err := c.BodyParser(&input); err != nil || strings.TrimSpace(input.ConcertID) == "" || strings.TrimSpace(input.ZoneID) == "" || len(input.SeatIDs) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ข้อมูลการล็อกที่นั่งไม่ถูกต้อง"})
	}

	now := time.Now().UTC()
	expiresAt := now.Add(seatHoldDuration)
	token := uuid.NewString()
	unavailable := make([]string, 0)
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var zone models.Zone
		if err := tx.Where("zone_id = ? AND concert_id = ?", input.ZoneID, input.ConcertID).First(&zone).Error; err != nil {
			return err
		}
		var seats []models.Seat
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("zone_id = ? AND seat_id IN ?", input.ZoneID, input.SeatIDs).
			Order("seat_id").Find(&seats).Error; err != nil {
			return err
		}
		if len(seats) != len(input.SeatIDs) {
			return seatConflictError{Labels: []string{"ไม่พบที่นั่งบางรายการ"}}
		}
		for i := range seats {
			activeHold := seats[i].HoldToken != nil && seats[i].HoldExpiresAt != nil && seats[i].HoldExpiresAt.After(now)
			if !isSeatAvailable(seats[i].StatusSeat) || activeHold {
				unavailable = append(unavailable, seats[i].Label())
			}
		}
		if len(unavailable) > 0 {
			return seatConflictError{Labels: unavailable}
		}
		return tx.Model(&models.Seat{}).Where("zone_id = ? AND seat_id IN ?", input.ZoneID, input.SeatIDs).
			Updates(map[string]any{"hold_token": token, "hold_expires_at": expiresAt}).Error
	})
	if err != nil {
		var conflict seatConflictError
		if errors.As(err, &conflict) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": conflict.Error(), "unavailable_seats": conflict.Labels})
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "ไม่พบโซนในคอนเสิร์ตนี้"})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถล็อกที่นั่งได้"})
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"hold_token": token, "expires_at": expiresAt})
}

func (h *seatInventoryHandler) releaseSeatHold(c *fiber.Ctx) error {
	token := strings.TrimSpace(c.Params("token"))
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ไม่พบรหัสล็อกที่นั่ง"})
	}
	if err := h.db.Model(&models.Seat{}).Where("hold_token = ?", token).
		Updates(map[string]any{"hold_token": nil, "hold_expires_at": nil}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถยกเลิกการล็อกที่นั่งได้"})
	}
	return c.JSON(fiber.Map{"message": "ยกเลิกการล็อกที่นั่งแล้ว"})
}
