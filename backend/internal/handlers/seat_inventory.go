package handlers

import (
	"strings"

	"backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	seatStatusAvailable = "ว่าง"
	seatStatusTaken     = "ไม่ว่าง"
	ticketStatusIssued  = "พร้อมใช้งาน"
)

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

type seatConflictError struct{ Labels []string }

func (e seatConflictError) Error() string {
	return "ที่นั่งไม่ว่างแล้ว: " + strings.Join(e.Labels, ", ")
}

// reserveSeats reserves seats for a Booking without issuing Tickets.
func reserveSeats(tx *gorm.DB, bookingID, concertID, zoneID string, labels []string) ([]models.Seat, error) {
	if len(labels) == 0 {
		return nil, nil
	}

	var seats []models.Seat
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Joins("JOIN zones ON zones.zone_id = seats.zone_id").
		Where("zones.concert_id = ? AND seats.zone_id = ? AND seats.seat_label IN ?", concertID, zoneID, labels).
		Find(&seats).Error; err != nil {
		return nil, err
	}
	if len(seats) != len(labels) {
		return nil, seatConflictError{Labels: missingSeatLabels(labels, seats)}
	}

	seatIDs := make([]uint, 0, len(seats))
	for i := range seats {
		seatIDs = append(seatIDs, seats[i].SeatID)
	}
	result := tx.Model(&models.Seat{}).
		Where("seat_id IN ? AND status_seat = ? AND reserved_booking_id IS NULL", seatIDs, seatStatusAvailable).
		Updates(map[string]any{"status_seat": seatStatusTaken, "reserved_booking_id": bookingID})
	if result.Error != nil {
		return nil, result.Error
	}
	if int(result.RowsAffected) != len(seatIDs) {
		return nil, seatConflictError{Labels: labels}
	}

	for i := range seats {
		seats[i].StatusSeat = seatStatusTaken
		seats[i].ReservedBookingID = &bookingID
	}
	return seats, nil
}
