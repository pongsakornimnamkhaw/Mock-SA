package handlers

import (
	"strings"

	"backend/internal/models"
)

// สถานะที่นั่ง — status_seat เป็นตัวชี้ขาดว่าที่นั่งใบนี้ขายไปแล้วหรือยัง
const (
	seatStatusAvailable = "ว่าง"
	seatStatusTaken     = "ไม่ว่าง"
)

// สถานะตั๋ว เดินตามวงจร: จอง → อนุมัติสลิป → (หรือ) ถูกปฏิเสธ
const (
	ticketStatusPending   = "รอตรวจสอบ"
	ticketStatusIssued    = "พร้อมใช้งาน"
	ticketStatusCancelled = "ยกเลิก"
)

// parseSeatLabel แยกป้ายที่นั่งเป็นแถวกับคอลัมน์ เช่น "A12" → ("A", "12")
// ป้ายที่ไม่มีตัวเลข (เช่น "VIP") ถือเป็นแถวล้วน ป้ายที่เป็นตัวเลขล้วนถือเป็นคอลัมน์ล้วน
func parseSeatLabel(label string) (string, string) {
	trimmed := strings.TrimSpace(label)
	index := strings.IndexFunc(trimmed, func(r rune) bool { return r >= '0' && r <= '9' })
	if index < 0 {
		return trimmed, ""
	}
	return trimmed[:index], trimmed[index:]
}

// ticketingProjection คือชุดแถวของตารางขายบัตรที่แปลงมาจากผังที่นั่งหนึ่งผัง
type ticketingProjection struct {
	Zones      []models.Zone
	Seats      []models.Seat
	Categories []models.TicketCategory
}

// projectLayoutToTicketing แปลงผังที่พนักงานวาด (zoneDTO) เป็นแถวของ Zone/Seat/TicketCategory
// ที่นั่งที่ถูกปิดใช้งาน (disabled) จะไม่ถูกสร้าง เพราะขายไม่ได้
func projectLayoutToTicketing(concertID string, zones []zoneDTO) ticketingProjection {
	projection := ticketingProjection{
		Zones:      make([]models.Zone, 0, len(zones)),
		Seats:      make([]models.Seat, 0),
		Categories: make([]models.TicketCategory, 0, len(zones)),
	}

	for _, zone := range zones {
		if zone.ID == "" {
			continue
		}

		capacity := len(zone.SeatItems)
		if capacity == 0 {
			capacity = zone.Seats
		}

		projection.Zones = append(projection.Zones, models.Zone{
			ZoneID:     zone.ID,
			ZoneType:   zone.Type,
			Capacity:   capacity,
			PositionX:  zone.X,
			PositionY:  zone.Y,
			Width:      zone.Width,
			Height:     zone.Height,
			Rotation:   zone.Rotation,
			Shape:      zone.Shape,
			Color:      zone.Color,
			LayerOrder: zone.Layer,
		})

		projection.Categories = append(projection.Categories, models.TicketCategory{
			CategoryID:   "TC-" + zone.ID,
			CategoryName: zone.Name,
			Price:        zone.Price,
			Quantity:     capacity,
			ZoneID:       zone.ID,
		})

		for _, item := range zone.SeatItems {
			if item.Disabled || item.ID == "" {
				continue
			}
			row, column := parseSeatLabel(item.Name)
			projection.Seats = append(projection.Seats, models.Seat{
				SeatID:     item.ID,
				SeatRow:    row,
				SeatColumn: column,
				StatusSeat: seatStatusAvailable,
				ConcertID:  concertID,
				ZoneID:     zone.ID,
				PositionX:  item.X,
				PositionY:  item.Y,
			})
		}
	}

	return projection
}

// zoneIDsWithoutSeats คืนโซนที่ไม่มีที่นั่งเหลืออยู่แล้ว (ลบทิ้งได้โดยไม่ทำให้บัตรกำพร้า)
func zoneIDsWithoutSeats(all []string, used []string) []string {
	usedSet := make(map[string]struct{}, len(used))
	for _, id := range used {
		usedSet[id] = struct{}{}
	}
	removable := make([]string, 0, len(all))
	for _, id := range all {
		if _, ok := usedSet[id]; !ok {
			removable = append(removable, id)
		}
	}
	return removable
}

// missingSeatLabels บอกว่าป้ายที่นั่งที่ขอมา ใบไหนหาไม่เจอในฐานข้อมูล
func missingSeatLabels(requested []string, found []models.Seat) []string {
	foundSet := make(map[string]struct{}, len(found))
	for i := range found {
		foundSet[found[i].Label()] = struct{}{}
	}
	missing := make([]string, 0)
	for _, label := range requested {
		if _, ok := foundSet[label]; !ok {
			missing = append(missing, label)
		}
	}
	return missing
}
