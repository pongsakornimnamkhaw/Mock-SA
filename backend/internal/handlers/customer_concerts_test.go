package handlers

import (
	"encoding/json"
	"net/http"
	"testing"

	"backend/internal/mailer"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

func TestBookableCustomerConcertsHidesCancelledAndSortsByStartDate(t *testing.T) {
	rows := []models.Concert{
		{ConcertID: "CC_LATE", ConcertName: "งานปลายปี", StartDate: "2026-12-01", EndDate: "2026-12-02", StartTime: "18:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว"},
		{ConcertID: "CC_CANCELLED", ConcertName: "งานที่ยกเลิก", StartDate: "2026-01-01", EndDate: "2026-01-02", StartTime: "18:00:00", Location: "กรุงเทพฯ", Status: "ยกเลิกการจัด"},
		{ConcertID: "CC_EARLY", ConcertName: "งานต้นปี", StartDate: "2026-02-01", EndDate: "2026-02-02", StartTime: "18:00:00", Location: "เชียงใหม่", Status: "ยืนยันแล้ว"},
		{ConcertID: "CC_POSTPONED", ConcertName: "งานที่เลื่อน", StartDate: "2026-06-01", EndDate: "2026-06-02", StartTime: "18:00:00", Location: "ขอนแก่น", Status: "เลื่อนการจัด"},
	}

	got := bookableCustomerConcerts(rows)

	ids := make([]string, 0, len(got))
	for _, view := range got {
		ids = append(ids, view.ConcertID)
	}
	want := []string{"CC_EARLY", "CC_POSTPONED", "CC_LATE"}
	if len(ids) != len(want) {
		t.Fatalf("ได้ %v อยากได้ %v", ids, want)
	}
	for i := range want {
		if ids[i] != want[i] {
			t.Fatalf("ลำดับผิด: ได้ %v อยากได้ %v", ids, want)
		}
	}
}

func TestBookableCustomerConcertsReturnsEmptySliceNotNil(t *testing.T) {
	got := bookableCustomerConcerts(nil)
	if got == nil {
		t.Fatal("ต้องคืน slice ว่าง ไม่ใช่ nil มิฉะนั้น JSON จะกลายเป็น null")
	}
	if len(got) != 0 {
		t.Fatalf("ไม่มีข้อมูลเข้า ต้องได้ 0 รายการ แต่ได้ %d", len(got))
	}
}

func TestCustomerConcertListEndpointReturnsBookableConcerts(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New()
	registerCustomerAccountRoutes(app, db, mailer.LogMailer{}, "http://localhost:5173")

	seed := []models.Concert{
		{ConcertID: "CCLIST_B", ConcertName: "คอนเสิร์ตลำดับสอง", StartDate: "2026-11-05", EndDate: "2026-11-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว", MoreInfo: "ข้อมูลเพิ่มเติม"},
		{ConcertID: "CCLIST_A", ConcertName: "คอนเสิร์ตลำดับแรก", StartDate: "2026-10-05", EndDate: "2026-10-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "เชียงใหม่", Status: "ยืนยันแล้ว", MoreInfo: "ข้อมูลเพิ่มเติม"},
		{ConcertID: "CCLIST_X", ConcertName: "คอนเสิร์ตที่ยกเลิก", StartDate: "2026-09-05", EndDate: "2026-09-06", StartTime: "19:00:00", EndTime: "22:00:00", Location: "ขอนแก่น", Status: "ยกเลิกการจัด", MoreInfo: "ข้อมูลเพิ่มเติม"},
	}
	if err := db.Create(&seed).Error; err != nil {
		t.Fatal(err)
	}

	response := customerTestRequest(t, app, http.MethodGet, "/api/customer/concerts", nil, nil, http.StatusOK)
	var payload struct {
		Data []customerPromotionConcertDTO `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}

	positions := map[string]int{}
	for index, view := range payload.Data {
		positions[view.ConcertID] = index
	}
	if _, listed := positions["CCLIST_X"]; listed {
		t.Fatal("คอนเสิร์ตที่ยกเลิกต้องไม่อยู่ในรายการ")
	}
	first, hasFirst := positions["CCLIST_A"]
	second, hasSecond := positions["CCLIST_B"]
	if !hasFirst || !hasSecond {
		t.Fatalf("ต้องเจอคอนเสิร์ตที่ seed ไว้ทั้งสองรายการ: %#v", positions)
	}
	if first >= second {
		t.Fatal("ต้องเรียงตามวันเริ่มงาน งานที่ใกล้ถึงขึ้นก่อน")
	}
	for _, view := range payload.Data {
		if view.ConcertID == "CCLIST_A" && view.Location != "เชียงใหม่" {
			t.Fatalf("ข้อมูลคอนเสิร์ตไม่ครบ: %#v", view)
		}
	}
}
