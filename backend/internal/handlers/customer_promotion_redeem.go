package handlers

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// promotionOrder คือออเดอร์ที่กำลังจะจ่ายเงิน ใช้ประเมินว่ารหัสโปรโมชั่นใช้ได้ไหม
type promotionOrder struct {
	ConcertID   string
	ConcertName string
	ZoneID      string
	ZoneLabel   string
	Total       float64
}

// normalizePromotionText ทำข้อความให้เทียบกันได้ ตรงกับ normalizeMatchText ฝั่ง frontend
// (ตัวพิมพ์เล็ก, เก็บเฉพาะ a-z 0-9 และอักษรไทย, ที่เหลือยุบเป็นช่องว่างเดียว)
func normalizePromotionText(value string) string {
	var builder strings.Builder
	pendingSpace := false
	for _, r := range strings.ToLower(value) {
		keep := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || (r >= 'ก' && r <= '๙')
		if !keep {
			pendingSpace = true
			continue
		}
		if pendingSpace && builder.Len() > 0 {
			builder.WriteRune(' ')
		}
		builder.WriteRune(r)
		pendingSpace = false
	}
	return builder.String()
}

func promotionDiscountAmount(discount customerPromotionDiscountDTO, total float64) float64 {
	raw := discount.Value
	if discount.Type == "percent" {
		raw = total * discount.Value / 100
	}
	if discount.MaxDiscountAmount > 0 && raw > discount.MaxDiscountAmount {
		raw = discount.MaxDiscountAmount
	}
	if raw > total {
		raw = total
	}
	if raw < 0 {
		raw = 0
	}
	return math.Round(raw*100) / 100
}

func promotionMatchesConcert(view customerPromotionDTO, order promotionOrder) bool {
	if order.ConcertID != "" && view.Concert.ConcertID == order.ConcertID {
		return true
	}
	ordered := normalizePromotionText(order.ConcertName)
	promoted := normalizePromotionText(view.Concert.ConcertName)
	if ordered == "" || promoted == "" {
		return false
	}
	return strings.Contains(ordered, promoted) || strings.Contains(promoted, ordered)
}

func promotionMatchesZone(view customerPromotionDTO, order promotionOrder) bool {
	if len(view.Zones) == 0 {
		return true
	}
	zoneID := strings.ToLower(strings.TrimSpace(order.ZoneID))
	zoneLabel := normalizePromotionText(order.ZoneLabel)
	row := ""
	if runes := []rune(zoneID); len(runes) > 0 {
		row = string(runes[0])
	}
	for _, zone := range view.Zones {
		promotionZoneID := strings.ToLower(strings.TrimSpace(zone.ZoneID))
		promotionZoneName := normalizePromotionText(zone.ZoneName)
		if promotionZoneID != "" && promotionZoneID == zoneID {
			return true
		}
		if row != "" && strings.HasSuffix(promotionZoneID, "_"+row) {
			return true
		}
		if promotionZoneName != "" && promotionZoneName == zoneLabel {
			return true
		}
		if row != "" && strings.Contains(promotionZoneName, "โซน "+row) {
			return true
		}
	}
	return false
}

// promotionRejection คืนเหตุผลภาษาไทยว่าทำไมใช้โปรโมชั่นนี้กับออเดอร์นี้ไม่ได้
// คืนสตริงว่างแปลว่าใช้ได้
func promotionRejection(view customerPromotionDTO, order promotionOrder) string {
	if !promotionMatchesConcert(view, order) {
		return "รหัสนี้ใช้กับคอนเสิร์ตนี้ไม่ได้"
	}
	if !promotionMatchesZone(view, order) {
		return "รหัสนี้ใช้ได้เฉพาะบางโซนเท่านั้น"
	}
	if order.Total < view.Discount.MinimumOrder {
		return "ต้องมียอดสั่งซื้อขั้นต่ำ " + formatBaht(view.Discount.MinimumOrder) + " บาท"
	}
	if view.Validity.RemainingQuota <= 0 {
		return "โปรโมชั่นนี้ถูกใช้ครบจำนวนแล้ว"
	}
	return ""
}

func findPromotionByCode(views []customerPromotionDTO, code string) (customerPromotionDTO, bool) {
	wanted := strings.ToLower(strings.TrimSpace(code))
	if wanted == "" {
		return customerPromotionDTO{}, false
	}
	for _, view := range views {
		if strings.ToLower(strings.TrimSpace(view.Discount.PromoCode)) == wanted {
			return view, true
		}
	}
	return customerPromotionDTO{}, false
}

func formatBaht(amount float64) string {
	digits := strconv.FormatFloat(math.Trunc(math.Abs(amount)), 'f', 0, 64)
	groups := make([]string, 0, 4)
	for len(digits) > 3 {
		groups = append([]string{digits[len(digits)-3:]}, groups...)
		digits = digits[:len(digits)-3]
	}
	groups = append([]string{digits}, groups...)
	return strings.Join(groups, ",")
}

func (h *customerAccountHandler) redeemCustomerPromotion(c *fiber.Ctx) error {
	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		return customerError(c, fiber.StatusBadRequest, "กรุณากรอกรหัสโปรโมชั่น")
	}
	total, err := strconv.ParseFloat(strings.TrimSpace(c.Query("total", "0")), 64)
	if err != nil || total < 0 {
		return customerError(c, fiber.StatusBadRequest, "ยอดสั่งซื้อไม่ถูกต้อง")
	}
	views, err := h.findCustomerPromotions("", "", time.Now())
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถตรวจสอบรหัสโปรโมชั่นได้")
	}
	view, found := findPromotionByCode(views, code)
	if !found {
		return customerError(c, fiber.StatusNotFound, "ไม่พบรหัสโปรโมชั่นนี้ หรือโปรโมชั่นนี้ใช้งานไม่ได้แล้ว")
	}
	order := promotionOrder{
		ConcertID:   strings.TrimSpace(c.Query("concert_id")),
		ConcertName: strings.TrimSpace(c.Query("concert_name")),
		ZoneID:      strings.TrimSpace(c.Query("zone_id")),
		ZoneLabel:   strings.TrimSpace(c.Query("zone_label")),
		Total:       total,
	}
	if reason := promotionRejection(view, order); reason != "" {
		return customerError(c, fiber.StatusConflict, reason)
	}
	return c.JSON(fiber.Map{"data": fiber.Map{
		"promotion":       view,
		"discount_amount": promotionDiscountAmount(view.Discount, total),
	}})
}
