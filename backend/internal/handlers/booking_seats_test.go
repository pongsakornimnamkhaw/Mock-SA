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

func TestCreateBookingPersistsSelectedSeatsAsTickets(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"A1", "B2"}), fiber.StatusCreated)

	var tickets []models.Ticket
	if err := db.Order("seat_label").Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 2 {
		t.Fatalf("ต้องได้ตั๋ว 2 ใบ แต่ได้ %d", len(tickets))
	}
	if tickets[0].SeatLabel != "A1" || tickets[1].SeatLabel != "B2" {
		t.Fatalf("เลขที่นั่งบนตั๋วต้องตรงกับที่ลูกค้าเลือก: %q, %q", tickets[0].SeatLabel, tickets[1].SeatLabel)
	}
	if tickets[0].PriceTicket != 2000 {
		t.Fatalf("ราคาบนตั๋วต้องเป็น 2000 แต่ได้ %v", tickets[0].PriceTicket)
	}
	if tickets[0].StatusTicket != ticketStatusPending {
		t.Fatalf("ตั๋วที่เพิ่งจองต้องเป็น %q แต่ได้ %q", ticketStatusPending, tickets[0].StatusTicket)
	}
	if tickets[0].SeatID == "" || tickets[0].CategoryID == "" {
		t.Fatalf("ตั๋วต้องผูกกับที่นั่งและหมวดหมู่จริง: %+v", tickets[0])
	}

	var taken int64
	db.Model(&models.Seat{}).Where("concert_id = ? AND status_seat = ?", "CCBOOK", seatStatusTaken).Count(&taken)
	if taken != 2 {
		t.Fatalf("ที่นั่งที่จองแล้วต้องเปลี่ยนเป็นไม่ว่าง 2 ใบ แต่ได้ %d", taken)
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
	if tickets != 1 {
		t.Fatalf("ต้องไม่มีตั๋วค้างจากการจองที่ล้มเหลว — ต้องเหลือ 1 ใบ แต่มี %d", tickets)
	}
}

func TestApproveBookingIssuesExistingTicketsWithoutFabricatingSeats(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	RegisterBookingPaymentRoutes(app, db)

	if err := ensureZoneSeats(db, "CCBOOK", "A1"); err != nil {
		t.Fatal(err)
	}
	created := managementRequest(t, app, "POST", "/api/bookings", bookingInput([]string{"C3"}), fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/approve",
		map[string]any{"officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	var tickets []models.Ticket
	if err := db.Where("booking_id = ?", bookingID).Find(&tickets).Error; err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 1 {
		t.Fatalf("การอนุมัติต้องไม่สร้างตั๋วเพิ่ม — ต้องมี 1 ใบ แต่มี %d", len(tickets))
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
	if err := db.Where("concert_id = ? AND zone_id = ? AND (seat_row || seat_column) = ?", "CCBOOK", "A1", "D4").
		First(&seat).Error; err != nil {
		t.Fatal(err)
	}
	if seat.StatusSeat != seatStatusAvailable {
		t.Fatalf("ที่นั่งของการจองที่ถูกปฏิเสธต้องกลับมาว่าง แต่ได้ %q", seat.StatusSeat)
	}

	var ticket models.Ticket
	if err := db.Where("booking_id = ?", bookingID).First(&ticket).Error; err != nil {
		t.Fatal(err)
	}
	if ticket.StatusTicket != ticketStatusCancelled {
		t.Fatalf("ตั๋วต้องถูกยกเลิก แต่ได้ %q", ticket.StatusTicket)
	}
}
