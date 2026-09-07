package handlers

import (
	"testing"
	"time"
)

func redeemFixture(t *testing.T) customerPromotionDTO {
	t.Helper()
	now := time.Date(2026, 9, 4, 12, 0, 0, 0, promotionLocation)
	promotion, concert := visibleCustomerPromotionFixture(now)
	view, visible := customerPromotionView(promotion, concert, now)
	if !visible {
		t.Fatal("fixture promotion should be visible")
	}
	return view
}

func TestNormalizePromotionTextMatchesFrontendRules(t *testing.T) {
	cases := map[string]string{
		"Riverside Sound Festival": "riverside sound festival",
		"  โซน  B4!! ":              "โซน b4",
		"Neon-Pulse (2026)":        "neon pulse 2026",
	}
	for input, want := range cases {
		if got := normalizePromotionText(input); got != want {
			t.Fatalf("normalizePromotionText(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestPromotionDiscountAmountCapsAndRounds(t *testing.T) {
	percent := customerPromotionDiscountDTO{Type: "percent", Value: 15, MaxDiscountAmount: 300}
	if got := promotionDiscountAmount(percent, 4500); got != 300 {
		t.Fatalf("capped percent discount = %v, want 300", got)
	}
	if got := promotionDiscountAmount(percent, 1000); got != 150 {
		t.Fatalf("percent discount = %v, want 150", got)
	}
	fixed := customerPromotionDiscountDTO{Type: "fixed", Value: 500}
	if got := promotionDiscountAmount(fixed, 300); got != 300 {
		t.Fatalf("discount must not exceed total, got %v", got)
	}
	uncapped := customerPromotionDiscountDTO{Type: "percent", Value: 10, MaxDiscountAmount: 0}
	if got := promotionDiscountAmount(uncapped, 1234); got != 123.4 {
		t.Fatalf("uncapped percent discount = %v, want 123.4", got)
	}
}

func TestPromotionMatchesConcertByIDOrFuzzyName(t *testing.T) {
	view := redeemFixture(t)
	if !promotionMatchesConcert(view, promotionOrder{ConcertID: "CONCERT_VISIBLE"}) {
		t.Fatal("exact concert id should match")
	}
	if !promotionMatchesConcert(view, promotionOrder{ConcertID: "2", ConcertName: "คอนเสิร์ตทดสอบ 2026"}) {
		t.Fatal("fuzzy concert name should match when id differs")
	}
	if promotionMatchesConcert(view, promotionOrder{ConcertID: "2", ConcertName: "Starlight Festival"}) {
		t.Fatal("unrelated concert must not match")
	}
}

func TestPromotionMatchesZone(t *testing.T) {
	view := redeemFixture(t) // zones: [{ZONE_A, VIP}]
	if !promotionMatchesZone(view, promotionOrder{ZoneID: "zone_a"}) {
		t.Fatal("zone id should match case-insensitively")
	}
	if !promotionMatchesZone(view, promotionOrder{ZoneID: "A1", ZoneLabel: "VIP"}) {
		t.Fatal("zone label should match")
	}
	if promotionMatchesZone(view, promotionOrder{ZoneID: "C3", ZoneLabel: "โซน C"}) {
		t.Fatal("unrelated zone must not match")
	}
	open := view
	open.Zones = nil
	if !promotionMatchesZone(open, promotionOrder{ZoneID: "C3", ZoneLabel: "โซน C"}) {
		t.Fatal("promotion without zones applies to every zone")
	}
}

func TestPromotionRejectionExplainsWhyCodeCannotBeUsed(t *testing.T) {
	view := redeemFixture(t) // MinimumOrder 1000, zone ZONE_A/VIP, concert CONCERT_VISIBLE
	base := promotionOrder{ConcertID: "CONCERT_VISIBLE", ZoneID: "ZONE_A", ZoneLabel: "VIP", Total: 4500}

	if reason := promotionRejection(view, base); reason != "" {
		t.Fatalf("eligible order rejected: %s", reason)
	}

	wrongConcert := base
	wrongConcert.ConcertID = "CONCERT_OTHER"
	if reason := promotionRejection(view, wrongConcert); reason != "รหัสนี้ใช้กับคอนเสิร์ตนี้ไม่ได้" {
		t.Fatalf("unexpected concert rejection: %q", reason)
	}

	wrongZone := base
	wrongZone.ZoneID, wrongZone.ZoneLabel = "C3", "โซน C"
	if reason := promotionRejection(view, wrongZone); reason != "รหัสนี้ใช้ได้เฉพาะบางโซนเท่านั้น" {
		t.Fatalf("unexpected zone rejection: %q", reason)
	}

	tooSmall := base
	tooSmall.Total = 900
	if reason := promotionRejection(view, tooSmall); reason != "ต้องมียอดสั่งซื้อขั้นต่ำ 1,000 บาท" {
		t.Fatalf("unexpected minimum rejection: %q", reason)
	}

	noQuota := view
	noQuota.Validity.RemainingQuota = 0
	if reason := promotionRejection(noQuota, base); reason != "โปรโมชั่นนี้ถูกใช้ครบจำนวนแล้ว" {
		t.Fatalf("unexpected quota rejection: %q", reason)
	}
}

func TestFindPromotionByCodeIgnoresCaseAndSpaces(t *testing.T) {
	view := redeemFixture(t) // PromoCode "SAVE15"
	views := []customerPromotionDTO{view}
	if _, ok := findPromotionByCode(views, "  save15 "); !ok {
		t.Fatal("promo code lookup should trim and ignore case")
	}
	if _, ok := findPromotionByCode(views, "SAVE16"); ok {
		t.Fatal("unknown promo code must not match")
	}
	if _, ok := findPromotionByCode(views, "   "); ok {
		t.Fatal("blank promo code must not match")
	}
}

func TestFormatBahtGroupsThousands(t *testing.T) {
	cases := map[float64]string{0: "0", 999: "999", 1000: "1,000", 1234567: "1,234,567"}
	for input, want := range cases {
		if got := formatBaht(input); got != want {
			t.Fatalf("formatBaht(%v) = %q, want %q", input, got, want)
		}
	}
}
