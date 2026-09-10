package handlers

import (
	"strings"
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestResendTicketsSendsEmailWithRealBookingData(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)

	booking := models.Booking{
		BookingID: "BKRESEND1", Status: "issued", CustomerEmail: "customer@example.com",
		ConcertTitle: "Riverside Sound Festival",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	// Ticket.SeatID มี FK ไปยัง seats.seat_id (ผ่าน Seat.Tickets ใน ticket.go) ต้องมี Zone+Seat จริงก่อน
	if err := db.Create(&models.Zone{ZoneID: "ZRESEND1", ZoneType: "นั่ง", Capacity: 2}).Error; err != nil {
		t.Fatal(err)
	}
	seats := []models.Seat{
		{SeatID: "S1", SeatRow: "A", SeatColumn: "1", StatusSeat: seatStatusTaken, ConcertID: "CCRESEND1", ZoneID: "ZRESEND1"},
		{SeatID: "S2", SeatRow: "A", SeatColumn: "2", StatusSeat: seatStatusTaken, ConcertID: "CCRESEND1", ZoneID: "ZRESEND1"},
	}
	if err := db.Create(&seats).Error; err != nil {
		t.Fatal(err)
	}
	tickets := []models.Ticket{
		{TicketID: "TKRESEND1", NameConcert: "Riverside Sound Festival", StatusTicket: ticketStatusIssued, SeatID: "S1", SeatLabel: "A1", BookingID: "BKRESEND1"},
		{TicketID: "TKRESEND2", NameConcert: "Riverside Sound Festival", StatusTicket: ticketStatusIssued, SeatID: "S2", SeatLabel: "A2", BookingID: "BKRESEND1"},
	}
	if err := db.Create(&tickets).Error; err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings/BKRESEND1/resend-tickets", nil, fiber.StatusOK)

	if sender.calls != 1 {
		t.Fatalf("ต้องเรียก mailer.Send 1 ครั้ง แต่เรียก %d ครั้ง", sender.calls)
	}
	if sender.to != "customer@example.com" {
		t.Fatalf("ต้องส่งถึง customer@example.com แต่ส่งถึง %q", sender.to)
	}
	if !strings.Contains(sender.body, "Riverside Sound Festival") {
		t.Fatalf("เนื้อหาอีเมลต้องมีชื่องาน: %q", sender.body)
	}
	if !strings.Contains(sender.body, "A1") || !strings.Contains(sender.body, "A2") {
		t.Fatalf("เนื้อหาอีเมลต้องมีเลขที่นั่งจริงของทุกใบ: %q", sender.body)
	}
}

func TestResendTicketsRejectsBookingNotYetIssued(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)

	if err := db.Create(&models.Booking{BookingID: "BKRESEND2", Status: "under_review", CustomerEmail: "x@example.com"}).Error; err != nil {
		t.Fatal(err)
	}

	managementRequest(t, app, "POST", "/api/bookings/BKRESEND2/resend-tickets", nil, fiber.StatusBadRequest)

	if sender.calls != 0 {
		t.Fatalf("ห้ามส่งอีเมลถ้ายังไม่อนุมัติ แต่เรียก mailer.Send ไป %d ครั้ง", sender.calls)
	}
}
