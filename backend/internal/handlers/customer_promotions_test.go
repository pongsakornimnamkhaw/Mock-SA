package handlers

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"backend/internal/models"
)

func visibleCustomerPromotionFixture(now time.Time) (models.Promotion, models.Concert) {
	promotion := models.Promotion{
		PromotionID: "PROMO_VISIBLE", PromotionName: "ส่วนลดสำหรับลูกค้า", Description: "รายละเอียด",
		BannerImageUrl: []byte("https://example.test/banner.jpg"), Status: "active", ConcertID: "CONCERT_VISIBLE",
		DiscountInfos:      []models.DiscountInfo{{DiscountType: "percent", DiscountValue: 15, MaxDiscountAmount: 300, MinOrderValue: 1000, PromoCode: "SAVE15"}},
		Quotas:             []models.Quota{{StartDate: now.AddDate(0, 0, -1), EndDate: now.AddDate(0, 0, 1), TicketQuota: 100, UsedQuota: 25}},
		PromoConditions:    []models.PromoCondition{{ConditionDetail: "ใช้ได้หนึ่งครั้ง", MaxUsagePerUser: 1}},
		PromotionApprovals: []models.PromotionApproval{{StatusApproved: "approved", RequestedAt: now.Add(-time.Hour)}},
		Zones:              []models.Zone{{ZoneID: "ZONE_A", ZoneType: "VIP"}},
		UsageLogs:          []models.PromotionUsageLog{{UserName: "ข้อมูลภายใน", FinalAmount: 1200}},
		TotalRevenue:       99999,
	}
	concert := models.Concert{ConcertID: "CONCERT_VISIBLE", ConcertName: "คอนเสิร์ตทดสอบ", StartDate: "2026-10-01", EndDate: "2026-10-02", StartTime: "18:00:00", Location: "กรุงเทพฯ", Status: "ยืนยันแล้ว"}
	return promotion, concert
}

func TestCustomerPromotionViewPublishesOnlyEligibleData(t *testing.T) {
	now := time.Date(2026, 9, 4, 12, 0, 0, 0, promotionLocation)
	promotion, concert := visibleCustomerPromotionFixture(now)
	view, visible := customerPromotionView(promotion, concert, now)
	if !visible {
		t.Fatal("approved active promotion should be visible")
	}
	if view.Validity.RemainingQuota != 75 || view.Concert.ConcertID != concert.ConcertID || view.Discount.PromoCode != "SAVE15" {
		t.Fatalf("unexpected customer view: %#v", view)
	}
	raw, err := json.Marshal(view)
	if err != nil {
		t.Fatal(err)
	}
	for _, privateField := range []string{"promotion_usage_logs", "promotion_approvals", "total_revenue", "user_name"} {
		if strings.Contains(string(raw), privateField) {
			t.Fatalf("customer response leaked %s: %s", privateField, raw)
		}
	}
}

func TestCustomerPromotionViewRejectsUnavailablePromotions(t *testing.T) {
	now := time.Date(2026, 9, 4, 12, 0, 0, 0, promotionLocation)
	cases := []struct {
		name   string
		change func(*models.Promotion, *models.Concert)
	}{
		{"draft", func(p *models.Promotion, _ *models.Concert) { p.Status = "draft" }},
		{"not approved", func(p *models.Promotion, _ *models.Concert) { p.PromotionApprovals[0].StatusApproved = "pending" }},
		{"not started", func(p *models.Promotion, _ *models.Concert) { p.Quotas[0].StartDate = now.AddDate(0, 0, 1) }},
		{"expired", func(p *models.Promotion, _ *models.Concert) { p.Quotas[0].EndDate = now.AddDate(0, 0, -1) }},
		{"quota exhausted", func(p *models.Promotion, _ *models.Concert) { p.Quotas[0].UsedQuota = p.Quotas[0].TicketQuota }},
		{"concert cancelled", func(_ *models.Promotion, c *models.Concert) { c.Status = "ยกเลิกการจัด" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			promotion, concert := visibleCustomerPromotionFixture(now)
			tc.change(&promotion, &concert)
			if _, visible := customerPromotionView(promotion, concert, now); visible {
				t.Fatal("unavailable promotion was published")
			}
		})
	}
}
