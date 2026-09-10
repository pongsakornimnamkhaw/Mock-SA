package handlers

import (
	"testing"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

// TestFullBookingFlowProducesRealPaymentBookingTicketData ยืนยันว่าตลอดสาย
// จอง -> แนบสลิป -> อนุมัติ -> ดูรายการ ได้ข้อมูลจริงในตาราง payments/bookings/tickets
// ครบทุกจุด ไม่ต้องพึ่ง fallback ปั้นข้อมูลใด ๆ ฝั่งหน้าเว็บอีกต่อไป (Task 1-3 ของแผนนี้ลบ fallback ทิ้งแล้ว)
func TestFullBookingFlowProducesRealPaymentBookingTicketData(t *testing.T) {
	db := managementTestDB(t)
	sender := &captureMailer{}
	app := fiber.New()
	registerBookingPaymentRoutes(app, db, sender)
	RegisterSeatInventoryRoutes(app, db)

	if err := ensureZoneSeats(db, "CCFLOW", "A1"); err != nil {
		t.Fatal(err)
	}

	created := managementRequest(t, app, "POST", "/api/bookings", map[string]any{
		"concert_id": "CCFLOW", "concert_title": "งานทดสอบสาย E2E",
		"zone_id": "A1", "tier_name": "โซน A",
		"seats": []string{"A1"}, "quantity": 1,
		"unit_price": 2000, "discount_amount": 0, "total_price": 2000,
		"customer_name": "ลูกค้าทดสอบ", "customer_email": "e2e@example.com", "customer_phone": "0800000000",
		"slip_file_name": "slip.jpg", "slip_data_url": "data:image/jpeg;base64,QUJD",
	}, fiber.StatusCreated)
	bookingID := created["data"].(map[string]interface{})["booking_id"].(string)

	// 1) Payment ต้องถูกสร้างจริงตอนแนบสลิป
	var payment models.Payment
	if err := db.Where("booking_id = ?", bookingID).First(&payment).Error; err != nil {
		t.Fatal("ต้องมีแถวใน payments:", err)
	}
	if len(payment.EvidenceFile) == 0 {
		t.Fatal("Payment.EvidenceFile ต้องมีข้อมูลสลิปจริง ไม่ว่างเปล่า")
	}

	// 2) อนุมัติ
	managementRequest(t, app, "POST", "/api/sales/bookings/"+bookingID+"/approve",
		map[string]any{"officer_name": "พนักงานทดสอบ"}, fiber.StatusOK)

	// 3) ดูรายการผ่าน endpoint เดียวกับที่ frontend เรียก (getCustomerBookings)
	body := managementRequest(t, app, "GET", "/api/customer/account/bookings?email=e2e@example.com", nil, fiber.StatusOK)
	rows := body["data"].([]interface{})
	if len(rows) != 1 {
		t.Fatalf("ต้องเจอ 1 booking แต่เจอ %d", len(rows))
	}
	row := rows[0].(map[string]interface{})
	if row["status"] != "issued" {
		t.Fatalf("สถานะต้องเป็น issued แต่ได้ %v", row["status"])
	}
	ticketRows, ok := row["tickets"].([]interface{})
	if !ok || len(ticketRows) != 1 {
		t.Fatalf("ต้องมีตั๋วจริง 1 ใบติดมากับ response แต่ได้ %v", row["tickets"])
	}
	ticket := ticketRows[0].(map[string]interface{})
	if ticket["seat_label"] != "A1" {
		t.Fatalf("เลขที่นั่งบนตั๋วต้องเป็น A1 (ที่นั่งที่เลือกจริง) แต่ได้ %v", ticket["seat_label"])
	}
	if ticket["status_ticket"] != ticketStatusIssued {
		t.Fatalf("ตั๋วต้องเป็นสถานะ %q แต่ได้ %v", ticketStatusIssued, ticket["status_ticket"])
	}

	// 4) ส่งบัตรซ้ำ ต้องส่งอีเมลจริงโดยใช้ CustomerEmail จาก Booking
	managementRequest(t, app, "POST", "/api/bookings/"+bookingID+"/resend-tickets", nil, fiber.StatusOK)
	if sender.calls != 1 || sender.to != "e2e@example.com" {
		t.Fatalf("resend ต้องส่งอีเมลถึง e2e@example.com 1 ครั้ง แต่ได้ to=%q calls=%d", sender.to, sender.calls)
	}
}
