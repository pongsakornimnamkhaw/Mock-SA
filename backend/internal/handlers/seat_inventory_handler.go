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
	SeatID     string  `json:"seat_id"`
	Label      string  `json:"label"`
	SeatRow    string  `json:"seat_row"`
	SeatColumn string  `json:"seat_column"`
	Status     string  `json:"status"`
	PositionX  float64 `json:"position_x"`
	PositionY  float64 `json:"position_y"`
}

// listZones คืนโซนของคอนเสิร์ตนี้ — Zone ไม่มี concert_id (ตามไดอะแกรม)
// จึงหาโซนผ่านที่นั่งของคอนเสิร์ตแทน
func (h *seatInventoryHandler) listZones(c *fiber.Ctx) error {
	concertID := c.Params("id")

	var zoneIDs []string
	if err := h.db.Model(&models.Seat{}).Where("concert_id = ?", concertID).
		Distinct().Order("zone_id").Pluck("zone_id", &zoneIDs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ไม่สามารถโหลดโซนได้"})
	}

	result := make([]zoneInventoryDTO, 0, len(zoneIDs))
	for _, zoneID := range zoneIDs {
		var zone models.Zone
		if err := h.db.First(&zone, "zone_id = ?", zoneID).Error; err != nil {
			zone = models.Zone{ZoneID: zoneID}
		}

		var category models.TicketCategory
		_ = h.db.Where("zone_id = ?", zoneID).First(&category).Error

		var available int64
		h.db.Model(&models.Seat{}).
			Where("concert_id = ? AND zone_id = ? AND status_seat = ?", concertID, zoneID, seatStatusAvailable).
			Count(&available)

		var capacity int64
		h.db.Model(&models.Seat{}).
			Where("concert_id = ? AND zone_id = ?", concertID, zoneID).
			Count(&capacity)

		result = append(result, zoneInventoryDTO{
			ZoneID:       zoneID,
			ZoneType:     zone.ZoneType,
			CategoryName: category.CategoryName,
			Color:        zone.Color,
			Price:        category.Price,
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
	if err := h.db.Where("concert_id = ? AND zone_id = ?", concertID, zoneID).
		Order("seat_row, length(seat_column), seat_column").Find(&seats).Error; err != nil {
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
	if err := db.Model(&models.Seat{}).
		Where("concert_id = ? AND zone_id = ?", concertID, zoneID).Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	price := defaultZonePrices[zoneID[0]]

	return db.Transaction(func(tx *gorm.DB) error {
		zone := models.Zone{ZoneID: zoneID, ZoneType: "ที่นั่ง", Capacity: defaultGridRows * defaultGridColumns}
		if err := tx.Where("zone_id = ?", zoneID).FirstOrCreate(&zone).Error; err != nil {
			return err
		}

		category := models.TicketCategory{
			CategoryID:   "TC-" + zoneID,
			CategoryName: "โซน " + zoneID,
			Price:        price,
			Quantity:     defaultGridRows * defaultGridColumns,
			ZoneID:       zoneID,
		}
		if err := tx.Where("category_id = ?", category.CategoryID).FirstOrCreate(&category).Error; err != nil {
			return err
		}

		seats := make([]models.Seat, 0, defaultGridRows*defaultGridColumns)
		for rowIndex := 0; rowIndex < defaultGridRows; rowIndex++ {
			row := string(rune('A' + rowIndex))
			for column := 1; column <= defaultGridColumns; column++ {
				label := fmt.Sprintf("%s%d", row, column)
				seats = append(seats, models.Seat{
					SeatID:     fmt.Sprintf("ST-%s-%s-%s", concertID, zoneID, label),
					SeatRow:    row,
					SeatColumn: fmt.Sprintf("%d", column),
					StatusSeat: seatStatusAvailable,
					ConcertID:  concertID,
					ZoneID:     zoneID,
				})
			}
		}
		return tx.Create(&seats).Error
	})
}
