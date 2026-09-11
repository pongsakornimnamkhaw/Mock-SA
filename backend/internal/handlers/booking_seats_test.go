package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func bookingInput(seats []string) map[string]any {
	return map[string]any{
		"concert_id": "CCBOOK", "concert_title": "งานทดสอบจอง",
		"zone_id": "A1", "tier_name": "โซน A",
		"seats": seats, "quantity": len(seats),
		"unit_price": 2000, "discount_amount": 0, "total_price": float64(2000 * len(seats)),
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "test@example.com", "customer_phone": "0800000000",
		"slip_file_name": "slip.jpg", "slip_data_url": "data:image/jpeg;base64,QUJD",
	}
}

func TestCreateBookingReservesSelectedSeatsWithoutIssuingTickets(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}

	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1", "B2"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	var tickets []models.Ticket
	if err := db.Order("seat_label").Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 0 {
		t.Fatalf("ก่อนอนุมัติยังต้องไม่มีตั๋ว แต่ได้ %d", len(tickets))
	}

	var taken int64
	if err := db.Table("seats").
		Where("zone_id = ? AND status_seat = ? AND reserved_booking_id = ?", "A1", seatStatusTaken, bookingID).
		Count(&taken).Error; err != nil {
		t.Fatal(err)
	}
	if taken != 2 {
		t.Fatalf("ที่นั่งที่จองแล้วต้องเปลี่ยนเป็นไม่ว่าง 2 ใบ แต่ได้ %d", taken)
	}
}

func TestCreateBookingConsumesValidSeatHold(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	var seat models.Seat
	if err := db.Where("zone_id = ? AND seat_label = ?", "A1", "A1").First(&seat).Error; err != nil {
		t.Fatal(err)
	}
	hold := managementRequest(t, app, "POST", "/api/seat-holds", map[string]any{
		"concert_id": "CCBOOK", "zone_id": "A1", "seat_ids": []uint{seat.SeatID},
	}, fiber.StatusCreated)
	token := hold["hold_token"].(string)

	input := bookingInput([]string{"A1"})
	input["hold_token"] = token
	managementRequest(t, app, "POST", "/api/bookings", input, fiber.StatusCreated)

	if err := db.First(&seat, seat.SeatID).Error; err != nil {
		t.Fatal(err)
	}
	if seat.StatusSeat != seatStatusTaken || seat.ReservedBookingID == nil {
		t.Fatalf("สร้าง booking แล้วต้องจองที่นั่งจริง: %+v", seat)
	}
	if seat.HoldToken != nil || seat.HoldExpiresAt != nil {
		t.Fatalf("สร้าง booking แล้วต้องล้าง hold: %+v", seat)
	}
}

func TestCreateBookingRejectsSeatHeldByAnotherToken(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterSeatInventoryRoutes(app, db)
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	var seat models.Seat
	if err := db.Where("zone_id = ? AND seat_label = ?", "A1", "A1").First(&seat).Error; err != nil {
		t.Fatal(err)
	}
	managementRequest(t, app, "POST", "/api/seat-holds", map[string]any{
		"concert_id": "CCBOOK", "zone_id": "A1", "seat_ids": []uint{seat.SeatID},
	}, fiber.StatusCreated)

	input := bookingInput([]string{"A1"})
	input["hold_token"] = "another-customer-token"
	managementRequest(t, app, "POST", "/api/bookings", input, fiber.StatusConflict)

	var bookings int64
	db.Model(&models.Booking{}).Count(&bookings)
	if bookings != 0 {
		t.Fatalf("token ผิดต้อง rollback booking แต่มี %d รายการ", bookings)
	}
}

func TestCreateBookingRejectsSeatsThatAreAlreadyTaken(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1"}), fiber.StatusCreated)

	body := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1", "A2"}), fiber.StatusConflict)
	if body["error"] == nil {
		t.Fatal("ต้องมีข้อความ error ภาษาไทยบอกว่าที่นั่งถูกจองไปแล้ว")
	}

	var bookings int64
	db.Model(&models.Booking{}).Count(&bookings)
	if bookings != 1 {
		t.Fatalf("การจองที่ชนกันต้อง rollback ทั้งก้อน — ต้องเหลือ 1 รายการ แต่มี %d", bookings)
	}
	var tickets int64
	db.Model(&models.Ticket{}).Count(&tickets)
	if tickets != 0 {
		t.Fatalf("ก่อนอนุมัติต้องไม่มีตั๋วค้าง แต่มี %d", tickets)
	}
}

func TestApproveBookingCreatesTicketsForReservedSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"C3"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)
	var before int64
	db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).Count(&before)
	if before != 0 {
		t.Fatalf("ก่อนอนุมัติต้องไม่มีตั๋ว แต่มี %d", before)
	}

	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/approve",
		map[string]any{"officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	var tickets []models.Ticket
	if err := db.Where("booking_id = ?", bookingID).Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 1 {
		t.Fatalf("การอนุมัติต้องสร้างตั๋ว 1 ใบ แต่มี %d", len(tickets))
	}
	if tickets[0].SeatLabel != "C3" {
		t.Fatalf("เลขที่นั่งต้องคงเป็น C3 แต่ได้ %q", tickets[0].SeatLabel)
	}
	if tickets[0].StatusTicket != ticketStatusIssued {
		t.Fatalf("ตั๋วต้องเปลี่ยนเป็น %q แต่ได้ %q", ticketStatusIssued, tickets[0].StatusTicket)
	}

	var fabricated int64
	db.Model(&models.Zone{}).Where("zone_id = ?", "ZONE-A").Count(&fabricated)
	if fabricated != 0 {
		t.Fatal("ต้องไม่มีโซนปลอม ZONE-A ถูกสร้างขึ้นอีก")
	}
}

func TestRejectBookingReleasesSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"D4"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/reject",
		map[string]any{"reason": "สลิปไม่ชัด", "officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	var seat models.Seat
	if err := db.Where("zone_id = ? AND seat_label = ?", "A1", "D4").
		First(&seat).Error; err != nil {
		t.Fatal(err)
	}
	if seat.StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งของการจองที่ถูกปฏิเสธต้องกลับมาว่าง แต่ได้ %q", seat.StatusSeat)
	}

	if seat.ReservedBookingID != nil {
		t.Fatalf("ที่นั่งที่ถูกปฏิเสธต้องล้างการจอง แต่ยังผูกกับ %q", *seat.ReservedBookingID)
	}

	var tickets int64
	db.Model(&models.Ticket{}).Where("booking_id = ?", bookingID).Count(&tickets)
	if tickets != 0 {
		t.Fatalf("Booking ที่ถูกปฏิเสธก่อนอนุมัติต้องไม่มีตั๋ว แต่มี %d", tickets)
	}
}
