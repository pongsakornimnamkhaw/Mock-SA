package handlers

import (
	"fmt"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type seatInventoryHandler struct {
	db *gorm.DB
}

// defaultZonePrices เป็นราคาตั้งต้นของคอนเสิร์ตสาธิตที่ยังไม่มีผังจริง
// ค่าตรงกับที่หน้าเว็บใช้มาก่อนหน้านี้ (frontend/src/components/SeatSelection/constants.ts)
var defaultZonePrices = map[byte]float64{'A': 2000, 'B': 1500, 'C': 1000}

const (
	defaultGridRows    = 5
	defaultGridColumns = 8
)

func RegisterSeatInventoryRoutes(app *fiber.App, db *gorm.DB) {
	h := &seatInventoryHandler{db: db}
	app.Get("/api/concerts/:id/zones", h.listZones)
	app.Get("/api/concerts/:id/zones/:zoneId/seats", h.listSeats)
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

	var zones []models.Zone
	if err := h.db.Where("concert_id = ?", concertID).Order("zone_id").Find(&zones).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดโซนได้"})
	}

	result := make([]zoneInventoryDTO, 0, len(zones))
	for _, zone := range zones {
		var available int64
		h.db.Model(&models.Seat{}).
			Where("zone_id = ? AND status_seat = ?", zone.ZoneID, seatStatusAvailable).
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

// listSeats คืนที่นั่งทั้งหมดในโซนพร้อมสถานะ
// คอนเสิร์ต/โซนที่ยังไม่มีผังจริงจะถูกสร้างผังเริ่มต้น 5x8 ให้ก่อน
func (h *seatInventoryHandler) listSeats(c *fiber.Ctx) error {
	concertID := c.Params("id")
	zoneID := c.Params("zoneId")

	if err := ensureZoneSeats(h.db, concertID, zoneID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถเตรียมผังที่นั่งได้"})
	}

	var seats []models.Seat
	if err := h.db.Joins("JOIN zones ON zones.zone_id = seats.zone_id").
		Where("zones.concert_id = ? AND seats.zone_id = ?", concertID, zoneID).
		Order("seats.seat_row, seats.seat_column").Find(&seats).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดที่นั่งได้"})
	}

	result := make([]seatInventoryDTO, 0, len(seats))
	for i := range seats {
		result = append(result, seatInventoryDTO{
			SeatID:     seats[i].SeatID,
			Label:      seats[i].Label(),
			SeatRow:    seats[i].SeatRow,
			SeatColumn: seats[i].SeatColumn,
			Status:     seats[i].StatusSeat,
			PositionX:  seats[i].PositionX,
			PositionY:  seats[i].PositionY,
		})
	}

	return c.JSON(fiber.Map{"data": result})
}

// ensureZoneSeats สร้างผังเริ่มต้น 5 แถว x 8 ที่ (A1–E8) พร้อมโซนและหมวดหมู่ราคา
// เมื่อคอนเสิร์ต/โซนนั้นยังไม่มีที่นั่งในฐานข้อมูล
func ensureZoneSeats(db *gorm.DB, concertID, zoneID string) error {
	if concertID == "" || zoneID == "" {
		return nil
	}

	var existing int64
	var zone models.Zone
	err := db.Where("zone_id = ?", zoneID).First(&zone).Error
	if err == nil && zone.ConcertID != concertID {
		return fmt.Errorf("zone %s belongs to another concert", zoneID)
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}
	if err := db.Model(&models.Seat{}).Where("zone_id = ?", zoneID).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	price := defaultZonePrices[zoneID[0]]

	return db.Transaction(func(tx *gorm.DB) error {
		zone := models.Zone{ZoneID: zoneID, ConcertID: concertID, ZoneType: "ที่นั่ง", Capacity: defaultGridRows * defaultGridColumns, ZonePrice: price}
		if err := tx.Where("zone_id = ?", zoneID).FirstOrCreate(&zone).Error; err != nil {
			return err
		}

		seats := make([]models.Seat, 0, defaultGridRows*defaultGridColumns)
		for rowIndex := 0; rowIndex < defaultGridRows; rowIndex++ {
			row := string(rune('A' + rowIndex))
			for column := 1; column <= defaultGridColumns; column++ {
				label := fmt.Sprintf("%s%d", row, column)
				seats = append(seats, models.Seat{
					SeatLabel:  label,
					SeatRow:    rowIndex + 1,
					SeatColumn: column,
					StatusSeat: seatStatusAvailable,
					ZoneID:     zoneID,
				})
			}
		}
		return tx.Create(&seats).Error
	})
}
