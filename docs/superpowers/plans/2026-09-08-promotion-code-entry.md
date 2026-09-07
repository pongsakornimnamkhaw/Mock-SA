# Promotion Selection & Promo Code Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ลูกค้าในหน้าเลือกที่นั่งเลือกโปรโมชั่นจาก dropdown ได้เสมอ และกรอกรหัสโปรโมชั่นเองได้ โดย backend เป็นผู้ตรวจสอบโค้ดและบอกเหตุผลเมื่อใช้ไม่ได้

**Architecture:** เพิ่ม endpoint `GET /api/customer/promotions/redeem` ใน Fiber handler เดิม (`customerAccountHandler`) ที่ค้นโปรโมชั่นจากรหัส แล้วประเมินเงื่อนไข (คอนเสิร์ต / โซน / ยอดขั้นต่ำ / โควตา) ด้วยฟังก์ชัน pure ที่เทสต์ได้ ฝั่ง frontend ดึงตรรกะการจับคู่โปรโมชั่นที่ฝังอยู่ในหน้า `SeatSelection` ออกมาเป็น `utils/seatPromotion.ts` (คุมด้วย Vitest ที่ติดตั้งใหม่) แล้วแทนที่บล็อกโปรโมชั่นใน `OrderSummary` ด้วยคอมโพเนนต์ `PromotionPicker` ที่แสดงเสมอ มีทั้ง dropdown และช่องกรอกโค้ด

**Tech Stack:** Go 1.x + Fiber v2 + GORM (backend) · React 19 + TypeScript + MUI v9 + Vite 8 (frontend) · Vitest + @testing-library/react (เทสต์ frontend ใหม่)

**Spec:** `docs/superpowers/specs/2026-09-08-promotion-code-entry.md`

## Global Constraints

- ข้อความที่ผู้ใช้เห็นทุกจุดต้องเป็นภาษาไทย ให้เข้ากับข้อความเดิมในไฟล์เดียวกัน
- Backend ตอบ error ด้วย `customerError(c, status, message)` เท่านั้น (รูปแบบ `{"error": "..."}`) — ห้ามเปลี่ยนรูปแบบ
- ห้ามเปลี่ยน shape ของ `customerPromotionDTO` / `CustomerPromotion` — ฝั่ง `Promotions` และ `PromotionDetail` ใช้ร่วมกันอยู่
- Route ใหม่ต้องลงทะเบียน **ก่อน** `group.Get("/promotions/:id", ...)` ที่ `backend/internal/handlers/customer_account.go:82` มิฉะนั้น Fiber จะจับ `redeem` เป็น `:id`
- Import ฝั่ง frontend ใช้ alias `@/` (ตั้งไว้ที่ `frontend/vite.config.ts`)
- คำสั่งทั้งหมดรันจาก `D:\SA\Mock-test\Mock-SA` (backend: `cd backend`, frontend: `cd frontend`)
- ห้ามใส่บรรทัด attribution ใน commit message

## File Structure

**Backend**
- `backend/internal/handlers/customer_promotion_redeem.go` (สร้าง) — ฟังก์ชัน pure สำหรับประเมินโปรโมชั่นต่อออเดอร์ + handler `redeemCustomerPromotion`
- `backend/internal/handlers/customer_promotion_redeem_test.go` (สร้าง) — เทสต์ฟังก์ชัน pure
- `backend/internal/handlers/customer_account.go` (แก้ บรรทัด 81–83) — ลงทะเบียน route ใหม่

**Frontend**
- `frontend/src/utils/seatPromotion.ts` (สร้าง) — ตรรกะจับคู่/คำนวณส่วนลด ย้ายออกจากหน้า SeatSelection
- `frontend/src/utils/seatPromotion.test.ts` (สร้าง) — เทสต์ตรรกะข้างบน
- `frontend/src/api/customerPromotionApi.ts` (แก้) — เพิ่ม `redeem()`
- `frontend/src/types/customerPromotion.ts` (แก้) — เพิ่ม `RedeemPromotionResult`
- `frontend/src/components/SeatSelection/PromotionPicker.tsx` (สร้าง) — UI โปรโมชั่นทั้งบล็อก แสดงเสมอ
- `frontend/src/components/SeatSelection/PromotionPicker.test.tsx` (สร้าง)
- `frontend/src/components/SeatSelection/OrderSummary.tsx` (แก้) — แทนบล็อกโปรโมชั่นเดิมด้วย `<PromotionPicker />`
- `frontend/src/pages/Customer/SeatSelection/index.tsx` (แก้) — state ของโค้ด + handler เรียก API
- `frontend/vite.config.ts`, `frontend/package.json`, `frontend/src/setupTests.ts` — ตั้ง Vitest

---

### Task 1: Backend — endpoint ตรวจรหัสโปรโมชั่น

**Files:**
- Create: `backend/internal/handlers/customer_promotion_redeem.go`
- Test: `backend/internal/handlers/customer_promotion_redeem_test.go`
- Modify: `backend/internal/handlers/customer_account.go:81-83`

**Interfaces:**
- Consumes: `customerPromotionDTO`, `customerPromotionDiscountDTO`, `customerPromotionZoneDTO` (จาก `customer_promotions.go`), `(*customerAccountHandler).findCustomerPromotions(id, concertID string, now time.Time) ([]customerPromotionDTO, error)`, `customerError(c *fiber.Ctx, status int, message string) error`, `visibleCustomerPromotionFixture(now time.Time) (models.Promotion, models.Concert)` (จาก `customer_promotions_test.go`)
- Produces:
  - `type promotionOrder struct { ConcertID, ConcertName, ZoneID, ZoneLabel string; Total float64 }`
  - `func normalizePromotionText(value string) string`
  - `func promotionDiscountAmount(discount customerPromotionDiscountDTO, total float64) float64`
  - `func promotionMatchesConcert(view customerPromotionDTO, order promotionOrder) bool`
  - `func promotionMatchesZone(view customerPromotionDTO, order promotionOrder) bool`
  - `func promotionRejection(view customerPromotionDTO, order promotionOrder) string` — คืน `""` เมื่อใช้ได้
  - `func findPromotionByCode(views []customerPromotionDTO, code string) (customerPromotionDTO, bool)`
  - `func formatBaht(amount float64) string`
  - `func (h *customerAccountHandler) redeemCustomerPromotion(c *fiber.Ctx) error`
  - HTTP: `GET /api/customer/promotions/redeem` (สัญญา response อยู่ในไฟล์ spec)

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `backend/internal/handlers/customer_promotion_redeem_test.go`:

```go
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
	view := redeemFixture(t) // concert CONCERT_VISIBLE / "คอนเสิร์ตทดสอบ"
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
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd backend && go test ./internal/handlers/ -run "Promotion|FormatBaht|Normalize" -v
```

Expected: FAIL — compile error `undefined: normalizePromotionText` (และฟังก์ชันอื่นที่ยังไม่มี)

- [ ] **Step 3: เขียน implementation**

สร้าง `backend/internal/handlers/customer_promotion_redeem.go`:

```go
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
```

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd backend && go test ./internal/handlers/ -run "Promotion|FormatBaht|Normalize" -v
```

Expected: PASS ทุกเคส

- [ ] **Step 5: ลงทะเบียน route (ต้องอยู่ก่อน `/promotions/:id`)**

แก้ `backend/internal/handlers/customer_account.go` บรรทัด 81–82 จาก

```go
	group.Get("/promotions", h.listCustomerPromotions)
	group.Get("/promotions/:id", h.getCustomerPromotion)
```

เป็น

```go
	group.Get("/promotions", h.listCustomerPromotions)
	group.Get("/promotions/redeem", h.redeemCustomerPromotion)
	group.Get("/promotions/:id", h.getCustomerPromotion)
```

- [ ] **Step 6: build + รันเทสต์ทั้ง package**

```bash
cd backend && go build ./... && go test ./internal/handlers/
```

Expected: build สำเร็จ, `ok  	backend/internal/handlers`

- [ ] **Step 7: Commit**

```bash
git add backend/internal/handlers/customer_promotion_redeem.go backend/internal/handlers/customer_promotion_redeem_test.go backend/internal/handlers/customer_account.go
git commit -m "feat(backend): add promo code redeem endpoint for seat checkout"
```

---

### Task 2: Frontend — ตั้ง Vitest และดึงตรรกะโปรโมชั่นออกมาเป็น util

เป้าหมายของ task นี้คือ **ไม่เปลี่ยนพฤติกรรมที่ผู้ใช้เห็น** แค่ย้ายตรรกะที่ฝังอยู่ในหน้า SeatSelection ออกมาให้เทสต์ได้ ก่อนจะไปแตะ UI ใน task ถัดไป

**Files:**
- Modify: `frontend/package.json` (devDependencies + script `test`)
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/setupTests.ts`
- Create: `frontend/src/utils/seatPromotion.ts`
- Test: `frontend/src/utils/seatPromotion.test.ts`
- Modify: `frontend/src/pages/Customer/SeatSelection/index.tsx` (ลบ `normalizeMatchText`, `calculateDiscount`, และ `useMemo` ของ `eligiblePromotions` แล้วเรียก util แทน)

**Interfaces:**
- Consumes: `CustomerPromotion` จาก `@/types/customerPromotion`
- Produces (จาก `@/utils/seatPromotion`):
  - `interface PromotionOrder { concertId: string; concertName: string; zoneId: string; zoneLabel: string; total: number }`
  - `function normalizeMatchText(value: string): string`
  - `function calculateDiscount(promotion: CustomerPromotion, total: number): number`
  - `function matchesConcert(promotion: CustomerPromotion, order: PromotionOrder): boolean`
  - `function matchesZone(promotion: CustomerPromotion, order: PromotionOrder): boolean`
  - `function filterEligiblePromotions(promotions: CustomerPromotion[], order: PromotionOrder): CustomerPromotion[]`

- [ ] **Step 1: ติดตั้ง Vitest และเครื่องมือเทสต์**

```bash
cd frontend && npm install -D vitest@^4 jsdom@^26 @testing-library/react@^16.3.0 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```

- [ ] **Step 2: เพิ่ม script `test` ใน `frontend/package.json`**

ใน `"scripts"` เพิ่มบรรทัดต่อจาก `"lint"`:

```json
    "test": "vitest"
```

- [ ] **Step 3: ตั้งค่า Vitest ใน `frontend/vite.config.ts`**

เปลี่ยน import บรรทัดแรกจาก `import { defineConfig } from 'vite'` เป็น `import { defineConfig } from 'vitest/config'` แล้วเพิ่ม block `test` ต่อจาก `resolve`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: สร้าง `frontend/src/setupTests.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/utils/seatPromotion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { CustomerPromotion } from '@/types/customerPromotion';
import {
    calculateDiscount,
    filterEligiblePromotions,
    matchesConcert,
    matchesZone,
    normalizeMatchText,
    type PromotionOrder,
} from '@/utils/seatPromotion';

const makePromotion = (overrides: Partial<CustomerPromotion> = {}): CustomerPromotion => ({
    promotion_id: 'PROMO_1',
    promotion_name: 'ลด 15%',
    description: '',
    banner_image_url: '',
    terms: '',
    discount: { type: 'percent', value: 15, max_discount_amount: 300, minimum_order: 1000, promo_code: 'SAVE15' },
    validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 100, used_quota: 25, remaining_quota: 75 },
    zones: [{ zone_id: 'ZONE_B', zone_name: 'โซน B' }],
    concert: {
        concert_id: 'CONCERT_1', concert_name: 'Riverside Sound Festival',
        start_date: '2026-10-16', end_date: '2026-10-18', start_time: '18:00:00',
        location: 'กรุงเทพฯ', status: 'ยืนยันแล้ว',
    },
    ...overrides,
});

const order: PromotionOrder = {
    concertId: 'CONCERT_1',
    concertName: 'Riverside Sound Festival',
    zoneId: 'B4',
    zoneLabel: 'โซน B',
    total: 4500,
};

describe('normalizeMatchText', () => {
    it('lowercases, strips punctuation and collapses whitespace', () => {
        expect(normalizeMatchText('Riverside Sound Festival')).toBe('riverside sound festival');
        expect(normalizeMatchText('  โซน  B4!! ')).toBe('โซน b4');
        expect(normalizeMatchText('Neon-Pulse (2026)')).toBe('neon pulse 2026');
    });
});

describe('calculateDiscount', () => {
    it('caps a percent discount at max_discount_amount', () => {
        expect(calculateDiscount(makePromotion(), 4500)).toBe(300);
    });

    it('computes an uncapped percent discount', () => {
        const promotion = makePromotion({
            discount: { type: 'percent', value: 10, max_discount_amount: 0, minimum_order: 0, promo_code: 'TEN' },
        });
        expect(calculateDiscount(promotion, 1234)).toBe(123.4);
    });

    it('never discounts more than the order total', () => {
        const promotion = makePromotion({
            discount: { type: 'fixed', value: 500, max_discount_amount: 0, minimum_order: 0, promo_code: 'FIX500' },
        });
        expect(calculateDiscount(promotion, 300)).toBe(300);
    });
});

describe('matchesConcert', () => {
    it('matches on exact concert id', () => {
        expect(matchesConcert(makePromotion(), order)).toBe(true);
    });

    it('matches fuzzily on concert name when the id differs', () => {
        expect(matchesConcert(makePromotion(), { ...order, concertId: '2' })).toBe(true);
    });

    it('rejects an unrelated concert', () => {
        expect(matchesConcert(makePromotion(), { ...order, concertId: '2', concertName: 'Starlight Festival' })).toBe(false);
    });

    it('rejects instead of matching everything when the promotion has no concert name', () => {
        const promotion = makePromotion({ concert: { ...makePromotion().concert, concert_id: 'X', concert_name: '' } });
        expect(matchesConcert(promotion, { ...order, concertId: '2' })).toBe(false);
    });
});

describe('matchesZone', () => {
    it('matches a zone row suffix such as ZONE_B against seat zone B4', () => {
        expect(matchesZone(makePromotion(), order)).toBe(true);
    });

    it('matches on the zone label', () => {
        const promotion = makePromotion({ zones: [{ zone_id: 'Z9', zone_name: 'โซน B' }] });
        expect(matchesZone(promotion, order)).toBe(true);
    });

    it('rejects a zone the promotion does not cover', () => {
        expect(matchesZone(makePromotion(), { ...order, zoneId: 'C3', zoneLabel: 'โซน C' })).toBe(false);
    });

    it('applies to every zone when the promotion lists none', () => {
        expect(matchesZone(makePromotion({ zones: [] }), { ...order, zoneId: 'C3', zoneLabel: 'โซน C' })).toBe(true);
    });
});

describe('filterEligiblePromotions', () => {
    it('drops promotions below the minimum order, without quota, or in another zone', () => {
        const promotions = [
            makePromotion({ promotion_id: 'OK' }),
            makePromotion({
                promotion_id: 'TOO_HIGH_MINIMUM',
                discount: { type: 'fixed', value: 100, max_discount_amount: 0, minimum_order: 9000, promo_code: 'BIG' },
            }),
            makePromotion({
                promotion_id: 'NO_QUOTA',
                validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 10, used_quota: 10, remaining_quota: 0 },
            }),
            makePromotion({ promotion_id: 'OTHER_ZONE', zones: [{ zone_id: 'ZONE_C', zone_name: 'โซน C' }] }),
        ];
        expect(filterEligiblePromotions(promotions, order).map((p) => p.promotion_id)).toEqual(['OK']);
    });

    it('sorts the biggest discount first', () => {
        const promotions = [
            makePromotion({ promotion_id: 'SMALL' }), // capped at 300
            makePromotion({
                promotion_id: 'BIG',
                discount: { type: 'fixed', value: 800, max_discount_amount: 0, minimum_order: 0, promo_code: 'BIG800' },
            }),
        ];
        expect(filterEligiblePromotions(promotions, order).map((p) => p.promotion_id)).toEqual(['BIG', 'SMALL']);
    });
});
```

- [ ] **Step 6: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/utils/seatPromotion.test.ts
```

Expected: FAIL — `Failed to resolve import "@/utils/seatPromotion"`

- [ ] **Step 7: เขียน `frontend/src/utils/seatPromotion.ts`**

```ts
import type { CustomerPromotion } from '@/types/customerPromotion';

/** ออเดอร์ที่กำลังเลือกที่นั่งอยู่ ใช้ตัดสินว่าโปรโมชั่นไหนใช้ได้ */
export interface PromotionOrder {
    concertId: string;
    concertName: string;
    zoneId: string;
    zoneLabel: string;
    total: number;
}

export const normalizeMatchText = (value: string) => value
    .toLocaleLowerCase('th-TH')
    .replace(/[^a-z0-9ก-๙]+/g, ' ')
    .trim();

export const calculateDiscount = (promotion: CustomerPromotion, total: number) => {
    const rawDiscount = promotion.discount.type === 'percent'
        ? total * promotion.discount.value / 100
        : promotion.discount.value;
    const cappedDiscount = promotion.discount.max_discount_amount > 0
        ? Math.min(rawDiscount, promotion.discount.max_discount_amount)
        : rawDiscount;
    return Math.max(0, Math.min(total, Math.round(cappedDiscount * 100) / 100));
};

export const matchesConcert = (promotion: CustomerPromotion, order: PromotionOrder) => {
    if (order.concertId && promotion.concert.concert_id === order.concertId) return true;
    const orderedName = normalizeMatchText(order.concertName);
    const promotedName = normalizeMatchText(promotion.concert.concert_name);
    // ถ้าฝั่งใดฝั่งหนึ่งไม่มีชื่อ อย่าถือว่าตรง มิฉะนั้น includes('') จะจับคู่ทุกอย่าง
    if (!orderedName || !promotedName) return false;
    return orderedName.includes(promotedName) || promotedName.includes(orderedName);
};

export const matchesZone = (promotion: CustomerPromotion, order: PromotionOrder) => {
    if (promotion.zones.length === 0) return true;
    const zoneId = order.zoneId.toLocaleLowerCase('th-TH');
    const zoneRow = zoneId.charAt(0);
    const zoneLabel = normalizeMatchText(order.zoneLabel);
    return promotion.zones.some((zone) => {
        const promotionZoneId = zone.zone_id.toLocaleLowerCase('th-TH');
        const promotionZoneName = normalizeMatchText(zone.zone_name);
        return promotionZoneId === zoneId
            || (zoneRow !== '' && promotionZoneId.endsWith(`_${zoneRow}`))
            || (promotionZoneName !== '' && promotionZoneName === zoneLabel)
            || (zoneRow !== '' && promotionZoneName.includes(`โซน ${zoneRow}`));
    });
};

export const filterEligiblePromotions = (promotions: CustomerPromotion[], order: PromotionOrder) => promotions
    .filter((promotion) => matchesConcert(promotion, order)
        && matchesZone(promotion, order)
        && order.total >= promotion.discount.minimum_order
        && promotion.validity.remaining_quota > 0)
    .sort((left, right) => calculateDiscount(right, order.total) - calculateDiscount(left, order.total));
```

- [ ] **Step 8: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/utils/seatPromotion.test.ts
```

Expected: PASS ทุกเคส

- [ ] **Step 9: ให้หน้า SeatSelection ใช้ util ตัวนี้แทนโค้ดในไฟล์**

ใน `frontend/src/pages/Customer/SeatSelection/index.tsx`:

1. ลบ `const normalizeMatchText = ...` และ `const calculateDiscount = ...` ที่อยู่บนสุดของไฟล์ทั้งสองก้อน
2. เพิ่ม import (ต่อจาก import ของ `customerPromotion` utils):

```ts
import { calculateDiscount, filterEligiblePromotions, type PromotionOrder } from '@/utils/seatPromotion';
```

3. แทนที่ `useMemo` ของ `eligiblePromotions` ทั้งก้อน (ตั้งแต่ `const eligiblePromotions = useMemo(` จนถึง `}, [event.title, id, promotions, totalPrice, zone, zoneInfo.label]);`) ด้วย:

```tsx
    const promotionOrder = useMemo<PromotionOrder>(() => ({
        concertId: id || '',
        concertName: event.title,
        zoneId: zone || '',
        zoneLabel: zoneInfo.label,
        total: totalPrice,
    }), [event.title, id, totalPrice, zone, zoneInfo.label]);

    const eligiblePromotions = useMemo(
        () => filterEligiblePromotions(promotions, promotionOrder),
        [promotions, promotionOrder],
    );
```

- [ ] **Step 10: ตรวจว่า type ผ่านและเทสต์ยังเขียว**

```bash
cd frontend && npx tsc -b && npm test -- --run
```

Expected: `tsc` ไม่มี error, เทสต์ทั้งหมด PASS

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/src/setupTests.ts frontend/src/utils/seatPromotion.ts frontend/src/utils/seatPromotion.test.ts frontend/src/pages/Customer/SeatSelection/index.tsx
git commit -m "refactor(frontend): extract seat promotion matching into tested util"
```

---

### Task 3: Frontend — เพิ่ม `customerPromotionApi.redeem()`

**Files:**
- Modify: `frontend/src/types/customerPromotion.ts`
- Modify: `frontend/src/api/customerPromotionApi.ts`
- Test: `frontend/src/api/customerPromotionApi.test.ts` (สร้าง)

**Interfaces:**
- Consumes: `GET /api/customer/promotions/redeem` (Task 1), helper `request<T>(path)` ที่มีอยู่แล้วใน `customerPromotionApi.ts` (ซึ่งแปลง `{"error": "..."}` เป็น `Error` พร้อมข้อความไทย)
- Produces:
  - `interface RedeemPromotionParams { code: string; concertId: string; concertName: string; zoneId: string; zoneLabel: string; total: number }`
  - `interface RedeemPromotionResult { promotion: CustomerPromotion; discount_amount: number }`
  - `customerPromotionApi.redeem(params: RedeemPromotionParams): Promise<{ data: RedeemPromotionResult }>`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/api/customerPromotionApi.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { customerPromotionApi } from '@/api/customerPromotionApi';

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
});

const params = {
    code: 'save15',
    concertId: '2',
    concertName: 'Riverside Sound Festival',
    zoneId: 'B4',
    zoneLabel: 'โซน B',
    total: 4500,
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('customerPromotionApi.redeem', () => {
    it('sends the order context as query parameters', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(200, { data: { promotion: { promotion_id: 'PROMO_1' }, discount_amount: 300 } }),
        );

        const result = await customerPromotionApi.redeem(params);

        expect(result.data.discount_amount).toBe(300);
        const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost');
        expect(requestedUrl.pathname).toBe('/api/customer/promotions/redeem');
        expect(requestedUrl.searchParams.get('code')).toBe('save15');
        expect(requestedUrl.searchParams.get('concert_id')).toBe('2');
        expect(requestedUrl.searchParams.get('concert_name')).toBe('Riverside Sound Festival');
        expect(requestedUrl.searchParams.get('zone_id')).toBe('B4');
        expect(requestedUrl.searchParams.get('zone_label')).toBe('โซน B');
        expect(requestedUrl.searchParams.get('total')).toBe('4500');
    });

    it('surfaces the backend rejection reason as an Error message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(409, { error: 'ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท' }),
        );

        await expect(customerPromotionApi.redeem(params)).rejects.toThrow('ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท');
    });

    it('surfaces a not-found code', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            jsonResponse(404, { error: 'ไม่พบรหัสโปรโมชั่นนี้ หรือโปรโมชั่นนี้ใช้งานไม่ได้แล้ว' }),
        );

        await expect(customerPromotionApi.redeem(params)).rejects.toThrow('ไม่พบรหัสโปรโมชั่นนี้');
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/api/customerPromotionApi.test.ts
```

Expected: FAIL — `customerPromotionApi.redeem is not a function`

- [ ] **Step 3: เพิ่ม type ใน `frontend/src/types/customerPromotion.ts`**

ต่อท้ายไฟล์:

```ts
export interface RedeemPromotionParams {
  code: string;
  concertId: string;
  concertName: string;
  zoneId: string;
  zoneLabel: string;
  total: number;
}

export interface RedeemPromotionResult {
  promotion: CustomerPromotion;
  discount_amount: number;
}
```

- [ ] **Step 4: เพิ่ม `redeem` ใน `frontend/src/api/customerPromotionApi.ts`**

แก้ import บรรทัดแรกเป็น:

```ts
import type {
  CustomerPromotion,
  CustomerPromotionConcert,
  RedeemPromotionParams,
  RedeemPromotionResult,
} from '@/types/customerPromotion';
```

แล้วเพิ่ม method ใน object `customerPromotionApi` ต่อจาก `getConcert`:

```ts
  redeem: (params: RedeemPromotionParams) => {
    const query = new URLSearchParams({
      code: params.code,
      concert_id: params.concertId,
      concert_name: params.concertName,
      zone_id: params.zoneId,
      zone_label: params.zoneLabel,
      total: String(params.total),
    });
    return request<{ data: RedeemPromotionResult }>(`/promotions/redeem?${query.toString()}`);
  },
```

- [ ] **Step 5: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/api/customerPromotionApi.test.ts
```

Expected: PASS ทั้ง 3 เคส

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/customerPromotion.ts frontend/src/api/customerPromotionApi.ts frontend/src/api/customerPromotionApi.test.ts
git commit -m "feat(frontend): add promo code redeem API client"
```

---

### Task 4: Frontend — คอมโพเนนต์ `PromotionPicker` (แสดงเสมอ + ช่องกรอกโค้ด)

คอมโพเนนต์นี้เป็น presentational ล้วน ไม่มี state ของตัวเอง ไม่เรียก API — ผู้เรียก (Task 5) เป็นคนถือ state

**Files:**
- Create: `frontend/src/components/SeatSelection/PromotionPicker.tsx`
- Test: `frontend/src/components/SeatSelection/PromotionPicker.test.tsx`

**Interfaces:**
- Consumes: `CustomerPromotion` จาก `@/types/customerPromotion`, `discountLabel(promotion)` จาก `@/utils/customerPromotion`
- Produces:
  - `interface PromotionPickerProps { eligiblePromotions: CustomerPromotion[]; redeemedPromotions: CustomerPromotion[]; selectedPromotionId: string; autoSelected: boolean; loading: boolean; loadError: string; codeValue: string; codeError: string; codeSuccess: string; codeSubmitting: boolean; disabled: boolean; onSelect: (promotionId: string) => void; onCodeChange: (value: string) => void; onCodeSubmit: () => void }`
  - `export default PromotionPicker`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

สร้าง `frontend/src/components/SeatSelection/PromotionPicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomerPromotion } from '@/types/customerPromotion';
import PromotionPicker, { type PromotionPickerProps } from '@/components/SeatSelection/PromotionPicker';

const promotion = (id: string, code: string): CustomerPromotion => ({
    promotion_id: id,
    promotion_name: `โปร ${id}`,
    description: '',
    banner_image_url: '',
    terms: '',
    discount: { type: 'percent', value: 15, max_discount_amount: 300, minimum_order: 0, promo_code: code },
    validity: { start_date: '2026-09-01', end_date: '2026-12-31', total_quota: 10, used_quota: 0, remaining_quota: 10 },
    zones: [],
    concert: {
        concert_id: 'CONCERT_1', concert_name: 'Riverside Sound Festival',
        start_date: '2026-10-16', end_date: '2026-10-18', start_time: '18:00:00',
        location: 'กรุงเทพฯ', status: 'ยืนยันแล้ว',
    },
});

const setup = (overrides: Partial<PromotionPickerProps> = {}) => {
    const props: PromotionPickerProps = {
        eligiblePromotions: [],
        redeemedPromotions: [],
        selectedPromotionId: '',
        autoSelected: false,
        loading: false,
        loadError: '',
        codeValue: '',
        codeError: '',
        codeSuccess: '',
        codeSubmitting: false,
        disabled: false,
        onSelect: vi.fn(),
        onCodeChange: vi.fn(),
        onCodeSubmit: vi.fn(),
        ...overrides,
    };
    render(<PromotionPicker {...props} />);
    return props;
};

describe('PromotionPicker', () => {
    it('shows the dropdown and the code field even when nothing is eligible', () => {
        setup();
        expect(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' })).toBeInTheDocument();
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeInTheDocument();
        expect(screen.getByText(/ยังไม่มีโปรโมชั่นที่ตรงกับยอดและโซนที่เลือก/)).toBeInTheDocument();
    });

    it('lists eligible and redeemed promotions without duplicates', async () => {
        const shared = promotion('PROMO_1', 'SAVE15');
        setup({ eligiblePromotions: [shared], redeemedPromotions: [shared, promotion('PROMO_2', 'EXTRA')] });

        await userEvent.click(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' }));

        expect(screen.getAllByRole('option')).toHaveLength(3); // ไม่ใช้โปรโมชั่น + PROMO_1 + PROMO_2
        expect(screen.getByRole('option', { name: /SAVE15/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /EXTRA/ })).toBeInTheDocument();
    });

    it('reports the chosen promotion id', async () => {
        const props = setup({ eligiblePromotions: [promotion('PROMO_1', 'SAVE15')] });

        await userEvent.click(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' }));
        await userEvent.click(screen.getByRole('option', { name: /SAVE15/ }));

        expect(props.onSelect).toHaveBeenCalledWith('PROMO_1');
    });

    it('submits the typed code', async () => {
        const props = setup({ codeValue: 'SAVE15' });
        await userEvent.click(screen.getByRole('button', { name: 'ใช้โค้ด' }));
        expect(props.onCodeSubmit).toHaveBeenCalledTimes(1);
    });

    it('reports each keystroke in the code field', async () => {
        const props = setup();
        await userEvent.type(screen.getByLabelText('รหัสโปรโมชั่น'), 'A');
        expect(props.onCodeChange).toHaveBeenCalledWith('A');
    });

    it('does not submit a blank code', async () => {
        const props = setup({ codeValue: '   ' });
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeDisabled();
        expect(props.onCodeSubmit).not.toHaveBeenCalled();
    });

    it('shows the rejection reason from the server', () => {
        setup({ codeError: 'ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท' });
        expect(screen.getByText('ต้องมียอดสั่งซื้อขั้นต่ำ 5,000 บาท')).toBeInTheDocument();
    });

    it('shows a success message after a code is applied', () => {
        setup({ codeSuccess: 'ใช้โค้ด SAVE15 แล้ว' });
        expect(screen.getByText('ใช้โค้ด SAVE15 แล้ว')).toBeInTheDocument();
    });

    it('locks every control once the seats are locked', () => {
        setup({ disabled: true, codeValue: 'SAVE15', eligiblePromotions: [promotion('PROMO_1', 'SAVE15')] });
        expect(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'ใช้โค้ด' })).toBeDisabled();
    });

    it('shows a loading state while promotions are being fetched', () => {
        setup({ loading: true });
        expect(screen.getByText('กำลังตรวจสอบโปรโมชั่น...')).toBeInTheDocument();
    });

    it('still offers the code field when the promotion list fails to load', () => {
        setup({ loadError: 'เชื่อมต่อ Backend ไม่ได้' });
        expect(screen.getByText(/โหลดรายการโปรโมชั่นไม่ได้/)).toBeInTheDocument();
        expect(screen.getByLabelText('รหัสโปรโมชั่น')).toBeEnabled();
    });
});
```

- [ ] **Step 2: รันเทสต์ให้เห็นว่ามันพัง**

```bash
cd frontend && npm test -- --run src/components/SeatSelection/PromotionPicker.test.tsx
```

Expected: FAIL — `Failed to resolve import "@/components/SeatSelection/PromotionPicker"`

- [ ] **Step 3: เขียนคอมโพเนนต์**

สร้าง `frontend/src/components/SeatSelection/PromotionPicker.tsx`:

```tsx
import type { FormEvent } from 'react';
import { Box, Typography, FormControl, Select, MenuItem, TextField, Button, Chip, CircularProgress } from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel } from '@/utils/customerPromotion';

export interface PromotionPickerProps {
    /** โปรโมชั่นที่ระบบจับคู่ให้เองจากคอนเสิร์ต/โซน/ยอดปัจจุบัน */
    eligiblePromotions: CustomerPromotion[];
    /** โปรโมชั่นที่ลูกค้ากรอกรหัสเข้ามาเองและผ่านการตรวจจาก backend แล้ว */
    redeemedPromotions: CustomerPromotion[];
    selectedPromotionId: string;
    autoSelected: boolean;
    loading: boolean;
    loadError: string;
    codeValue: string;
    codeError: string;
    codeSuccess: string;
    codeSubmitting: boolean;
    disabled: boolean;
    onSelect: (promotionId: string) => void;
    onCodeChange: (value: string) => void;
    onCodeSubmit: () => void;
}

const PromotionPicker = ({
    eligiblePromotions, redeemedPromotions, selectedPromotionId, autoSelected,
    loading, loadError, codeValue, codeError, codeSuccess, codeSubmitting, disabled,
    onSelect, onCodeChange, onCodeSubmit,
}: PromotionPickerProps) => {
    const options: CustomerPromotion[] = [];
    for (const promotion of [...redeemedPromotions, ...eligiblePromotions]) {
        if (!options.some((option) => option.promotion_id === promotion.promotion_id)) {
            options.push(promotion);
        }
    }

    const canSubmitCode = !disabled && !codeSubmitting && codeValue.trim() !== '';

    const handleSubmit = (formEvent: FormEvent) => {
        formEvent.preventDefault();
        if (canSubmitCode) onCodeSubmit();
    };

    return (
        <Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <LocalOfferOutlinedIcon sx={{ color: '#d63384', fontSize: 19 }} />
                    <Typography sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>โปรโมชั่น</Typography>
                </Box>
                {autoSelected && selectedPromotionId !== '' && (
                    <Chip size="small" label="เลือกให้อัตโนมัติ" color="success" sx={{ height: 22, fontSize: '0.68rem' }} />
                )}
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#777', py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography sx={{ fontSize: '0.78rem' }}>กำลังตรวจสอบโปรโมชั่น...</Typography>
                </Box>
            ) : (
                <FormControl fullWidth size="small">
                    <Select
                        value={selectedPromotionId}
                        onChange={(changeEvent) => onSelect(changeEvent.target.value)}
                        displayEmpty
                        disabled={disabled}
                        inputProps={{ 'aria-label': 'เลือกโปรโมชั่น' }}
                        sx={{ fontSize: '0.8rem', bgcolor: '#fff8fb' }}
                    >
                        <MenuItem value=""><em>ไม่ใช้โปรโมชั่น</em></MenuItem>
                        {options.map((promotion) => (
                            <MenuItem key={promotion.promotion_id} value={promotion.promotion_id} sx={{ fontSize: '0.8rem' }}>
                                {discountLabel(promotion)} · {promotion.discount.promo_code}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {!loading && loadError !== '' && (
                <Typography sx={{ color: '#d32f2f', fontSize: '0.72rem', mt: 0.75 }}>
                    โหลดรายการโปรโมชั่นไม่ได้ กรอกรหัสโปรโมชั่นเองได้ด้านล่าง
                </Typography>
            )}

            {!loading && loadError === '' && options.length === 0 && (
                <Typography sx={{ color: '#999', fontSize: '0.72rem', mt: 0.75 }}>
                    ยังไม่มีโปรโมชั่นที่ตรงกับยอดและโซนที่เลือก — ถ้ามีรหัสส่วนลด กรอกได้เลย
                </Typography>
            )}

            {!loading && autoSelected && selectedPromotionId !== '' && (
                <Typography sx={{ color: '#2e7d32', fontSize: '0.72rem', mt: 0.75 }}>
                    ✓ ระบบเลือกโปรโมชั่นที่ประหยัดที่สุดให้แล้ว
                </Typography>
            )}

            <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <TextField
                    label="รหัสโปรโมชั่น"
                    size="small"
                    fullWidth
                    value={codeValue}
                    disabled={disabled}
                    onChange={(changeEvent) => onCodeChange(changeEvent.target.value)}
                    slotProps={{ htmlInput: { maxLength: 40, autoCapitalize: 'characters', spellCheck: false } }}
                    sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                />
                <Button
                    type="submit"
                    variant="outlined"
                    disabled={!canSubmitCode}
                    sx={{
                        whiteSpace: 'nowrap', borderRadius: '8px', textTransform: 'none',
                        borderColor: '#d63384', color: '#d63384',
                        '&:hover': { borderColor: '#b02a6b', bgcolor: 'rgba(214,51,132,0.05)' },
                    }}
                >
                    {codeSubmitting ? <CircularProgress size={16} /> : 'ใช้โค้ด'}
                </Button>
            </Box>

            {codeError !== '' && (
                <Typography sx={{ color: '#d32f2f', fontSize: '0.72rem', mt: 0.75 }}>{codeError}</Typography>
            )}
            {codeError === '' && codeSuccess !== '' && (
                <Typography sx={{ color: '#2e7d32', fontSize: '0.72rem', mt: 0.75 }}>{codeSuccess}</Typography>
            )}
        </Box>
    );
};

export default PromotionPicker;
```

หมายเหตุสองข้อ:
- ตอน `codeSubmitting === true` ปุ่มจะแสดง spinner แทนคำว่า "ใช้โค้ด" — เทสต์ที่หาปุ่มด้วยชื่อ "ใช้โค้ด" จึงไม่ตั้งค่า `codeSubmitting`
- ถ้า MUI v9 ไม่ได้ใส่ `aria-disabled="true"` บน combobox ตอน disabled ให้เปลี่ยนบรรทัดนั้นในเทสต์เป็น `expect(screen.getByRole('combobox', { name: 'เลือกโปรโมชั่น' })).toHaveClass('Mui-disabled')` แทน — อย่าแก้คอมโพเนนต์เพื่อให้เทสต์ผ่าน

- [ ] **Step 4: รันเทสต์ให้ผ่าน**

```bash
cd frontend && npm test -- --run src/components/SeatSelection/PromotionPicker.test.tsx
```

Expected: PASS ทุกเคส

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SeatSelection/PromotionPicker.tsx frontend/src/components/SeatSelection/PromotionPicker.test.tsx
git commit -m "feat(frontend): add always-visible promotion picker with promo code field"
```

---

### Task 5: Frontend — ต่อ `PromotionPicker` เข้ากับหน้าเลือกที่นั่ง

**Files:**
- Modify: `frontend/src/components/SeatSelection/OrderSummary.tsx` (แทนบล็อกโปรโมชั่นเดิม + ตัด props เดิมทิ้ง)
- Modify: `frontend/src/pages/Customer/SeatSelection/index.tsx` (state ของโค้ด + handler + ส่ง props)

**Interfaces:**
- Consumes: `PromotionPicker` + `PromotionPickerProps` (Task 4), `customerPromotionApi.redeem` (Task 3), `filterEligiblePromotions` / `calculateDiscount` / `PromotionOrder` (Task 2)
- Produces: `OrderSummaryProps.promotion: PromotionPickerProps` — แทน props เดิม 5 ตัว (`eligiblePromotions`, `selectedPromotionId`, `promotionsLoading`, `promotionError`, `onPromotionChange`)

- [ ] **Step 1: แก้ `OrderSummary.tsx` ให้รับ props ก้อนเดียว**

1.1 แก้ import 3 บรรทัดบนสุดของไฟล์ จาก

```tsx
import { Box, Typography, Button, Paper, LinearProgress, FormControl, Select, MenuItem, Chip, CircularProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
```

เป็น

```tsx
import { Box, Typography, Button, Paper, LinearProgress } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import PromotionPicker, { type PromotionPickerProps } from '@/components/SeatSelection/PromotionPicker';
```

1.2 ลบ import ที่ไม่ใช้แล้วสองบรรทัด:

```tsx
import type { CustomerPromotion } from '@/types/customerPromotion';
import { discountLabel } from '@/utils/customerPromotion';
```

1.3 ใน `interface OrderSummaryProps` ลบ 5 บรรทัดนี้

```tsx
    eligiblePromotions: CustomerPromotion[];
    selectedPromotionId: string;
    promotionsLoading: boolean;
    promotionError: string;
    onPromotionChange: (promotionId: string) => void;
```

แล้วใส่แทนด้วย

```tsx
    promotion: PromotionPickerProps;
```

1.4 แก้ destructuring ของคอมโพเนนต์ จาก

```tsx
const OrderSummary = ({
    event, zone, zoneInfo, activeSeats, selectedSeats, isLocked, timeLeft, totalPrice,
    finalPrice, discountAmount, eligiblePromotions, selectedPromotionId,
    promotionsLoading, promotionError, onPromotionChange,
    handleLockSeats, handlePayment, handleCancelLock, onBack
}: OrderSummaryProps) => {
```

เป็น

```tsx
const OrderSummary = ({
    event, zone, zoneInfo, activeSeats, selectedSeats, isLocked, timeLeft, totalPrice,
    finalPrice, discountAmount, promotion,
    handleLockSeats, handlePayment, handleCancelLock, onBack
}: OrderSummaryProps) => {
```

1.5 แทนบล็อกโปรโมชั่นทั้งก้อน — ตั้งแต่ `<Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 2 }}>` ที่มี `LocalOfferOutlinedIcon` อยู่ข้างใน ไปจนถึง `</Box>` ปิดก้อนนั้น (ก้อนที่อยู่ก่อน `<Box sx={{ borderTop: '1px solid #eee', pt: 2, mb: 3 }}>`) — ด้วยบรรทัดเดียว:

```tsx
            <PromotionPicker {...promotion} />
```

- [ ] **Step 2: ตรวจว่า type พังตามคาด (ยังไม่ได้แก้หน้าเรียก)**

```bash
cd frontend && npx tsc -b
```

Expected: FAIL — `Property 'promotion' is missing` ที่ `frontend/src/pages/Customer/SeatSelection/index.tsx`

- [ ] **Step 3: เพิ่ม state และ handler ใน `SeatSelection/index.tsx`**

3.1 แก้ import ของ `seatPromotion` ให้ครบ:

```tsx
import { calculateDiscount, filterEligiblePromotions, type PromotionOrder } from '@/utils/seatPromotion';
```

3.2 เพิ่ม state ต่อจาก `const [promotionSelectionTouched, setPromotionSelectionTouched] = useState(false);`

```tsx
    const [redeemedPromotions, setRedeemedPromotions] = useState<CustomerPromotion[]>([]);
    const [codeValue, setCodeValue] = useState('');
    const [codeError, setCodeError] = useState('');
    const [codeSuccess, setCodeSuccess] = useState('');
    const [codeSubmitting, setCodeSubmitting] = useState(false);
```

3.3 ใน `useEffect` ที่โหลดโปรโมชั่น (`}, [id, zone]);`) เพิ่มการรีเซ็ตต่อจาก `setPromotionSelectionTouched(false);`

```tsx
        setRedeemedPromotions([]);
        setCodeValue('');
        setCodeError('');
        setCodeSuccess('');
```

3.4 ต่อจาก `eligiblePromotions` (ที่สร้างใน Task 2) เพิ่มการรวมโปรโมชั่นที่แลกด้วยโค้ด:

```tsx
    // โค้ดที่แลกไว้แล้วอาจใช้ไม่ได้ถ้าลูกค้าเอาที่นั่งออกจนยอดต่ำกว่าขั้นต่ำ
    const activeRedeemedPromotions = useMemo(
        () => redeemedPromotions.filter((promotion) => totalPrice >= promotion.discount.minimum_order
            && promotion.validity.remaining_quota > 0),
        [redeemedPromotions, totalPrice],
    );

    const droppedRedeemedCode = activeRedeemedPromotions.length < redeemedPromotions.length;

    const selectablePromotions = useMemo(() => {
        const merged: CustomerPromotion[] = [];
        for (const promotion of [...activeRedeemedPromotions, ...eligiblePromotions]) {
            if (!merged.some((option) => option.promotion_id === promotion.promotion_id)) {
                merged.push(promotion);
            }
        }
        return merged.sort((left, right) => calculateDiscount(right, totalPrice) - calculateDiscount(left, totalPrice));
    }, [activeRedeemedPromotions, eligiblePromotions, totalPrice]);
```

3.5 แก้ effect ที่เลือกโปรโมชั่นอัตโนมัติ ให้ดูจาก `selectablePromotions` แทน `eligiblePromotions`:

```tsx
    useEffect(() => {
        if (selectedPromotionId && selectablePromotions.some((promotion) => promotion.promotion_id === selectedPromotionId)) return;
        if (!promotionSelectionTouched && selectablePromotions.length > 0) {
            setSelectedPromotionId(selectablePromotions[0].promotion_id);
            return;
        }
        setSelectedPromotionId('');
    }, [selectablePromotions, promotionSelectionTouched, selectedPromotionId]);
```

3.6 แก้บรรทัด `selectedPromotion` ให้หาใน `selectablePromotions`:

```tsx
    const selectedPromotion = selectablePromotions.find((promotion) => promotion.promotion_id === selectedPromotionId) ?? null;
```

3.7 แก้ `handlePromotionChange` และเพิ่ม `handleApplyCode` ต่อท้าย:

```tsx
    const handlePromotionChange = (promotionId: string) => {
        setPromotionSelectionTouched(true);
        setSelectedPromotionId(promotionId);
        setCodeError('');
    };

    const handleApplyCode = async () => {
        const code = codeValue.trim();
        if (!code || codeSubmitting) return;
        setCodeSubmitting(true);
        setCodeError('');
        setCodeSuccess('');
        try {
            const { data } = await customerPromotionApi.redeem({ ...promotionOrder, code });
            setRedeemedPromotions((previous) => [
                data.promotion,
                ...previous.filter((promotion) => promotion.promotion_id !== data.promotion.promotion_id),
            ]);
            setPromotionSelectionTouched(true);
            setSelectedPromotionId(data.promotion.promotion_id);
            setCodeSuccess(`ใช้โค้ด ${data.promotion.discount.promo_code} แล้ว`);
            setCodeValue('');
        } catch (reason) {
            setCodeError(reason instanceof Error ? reason.message : 'ใช้รหัสโปรโมชั่นนี้ไม่ได้');
        } finally {
            setCodeSubmitting(false);
        }
    };
```

- [ ] **Step 4: ส่ง props ให้ `OrderSummary`**

ใน JSX ลบ 5 บรรทัดนี้ออกจาก `<OrderSummary ... />`

```tsx
                        eligiblePromotions={eligiblePromotions}
                        selectedPromotionId={selectedPromotionId}
                        promotionsLoading={promotionsLoading}
                        promotionError={promotionError}
                        onPromotionChange={handlePromotionChange}
```

แล้วใส่แทนด้วย

```tsx
                        promotion={{
                            eligiblePromotions,
                            redeemedPromotions: activeRedeemedPromotions,
                            selectedPromotionId,
                            autoSelected: !promotionSelectionTouched && selectedPromotionId !== '',
                            loading: promotionsLoading,
                            loadError: promotionError,
                            codeValue,
                            codeError: codeError || (droppedRedeemedCode ? 'ยอดสั่งซื้อตอนนี้ไม่ถึงขั้นต่ำของโค้ดที่กรอกไว้' : ''),
                            codeSuccess,
                            codeSubmitting,
                            disabled: isLocked,
                            onSelect: handlePromotionChange,
                            onCodeChange: setCodeValue,
                            onCodeSubmit: handleApplyCode,
                        }}
```

- [ ] **Step 5: ตรวจ type, lint และเทสต์ทั้งหมด**

```bash
cd frontend && npx tsc -b && npm run lint && npm test -- --run
```

Expected: `tsc` ไม่มี error, lint ผ่าน, เทสต์ทั้งหมด PASS

- [ ] **Step 6: ตรวจของจริงในเบราว์เซอร์**

6.1 สร้าง `.claude/launch.json` ถ้ายังไม่มี (ให้ preview tool ใช้):

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "frontend", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--prefix", "frontend"], "port": 5173 }
  ]
}
```

6.2 รัน backend ในอีกเทอร์มินัลหนึ่ง (ต้องรัน ไม่งั้น `/api` จะ proxy ไม่ติด) แล้วเปิด preview ด้วย `preview_start` ชื่อ `frontend` และไปที่เส้นทางหน้าเลือกที่นั่ง เช่น `/event/2/seats/B4`

6.3 ตรวจให้ครบ 4 ข้อ:
- บล็อก "โปรโมชั่น" แสดง dropdown + ช่อง "รหัสโปรโมชั่น" + ปุ่ม "ใช้โค้ด" ถึงแม้จะไม่มีโปรโมชั่นที่เข้าเงื่อนไข
- กรอกโค้ดที่ใช้ได้ → โปรโมชั่นโผล่ใน dropdown, ถูกเลือกให้, ยอดชำระลดลง, มีข้อความ "ใช้โค้ด ... แล้ว"
- กรอกโค้ดมั่ว → ขึ้น "ไม่พบรหัสโปรโมชั่นนี้ ..." สีแดง และยอดชำระไม่เปลี่ยน
- กดชำระเงิน (ล็อคที่นั่ง) → dropdown/ช่องโค้ด/ปุ่ม ถูก disable ทั้งหมด

6.4 เช็ค console ด้วย `read_console_messages` ว่าไม่มี error แล้วเก็บ screenshot ของบล็อกโปรโมชั่นส่งให้เจ้าของงาน

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SeatSelection/OrderSummary.tsx frontend/src/pages/Customer/SeatSelection/index.tsx .claude/launch.json
git commit -m "feat(frontend): let customers pick a promotion or enter a promo code at checkout"
```

---

## Notes for the executor

- **`activeSeats` เปลี่ยนตอนล็อค:** `totalPrice` คิดจาก `activeSeats` ซึ่งสลับระหว่าง `selectedSeats` กับ `lockedSeats` ตอนล็อคจำนวนที่นั่งเท่าเดิม ยอดจึงไม่กระโดด — แต่ถ้าเห็นยอดเปลี่ยนตอนกดล็อค ให้หยุดแล้วรายงาน อย่าแก้ข้ามขอบเขต
- **โควตายังไม่ถูกตัด:** `used_quota` ไม่ได้ลดตอนจ่ายเงิน เพราะการจ่ายเงินยังเป็นระบบจำลอง (อยู่นอกขอบเขตตาม spec)
- **`discountAmount` ที่ส่งเข้า `bookingPaymentApi.createBooking`** ยังคำนวณฝั่ง client เหมือนเดิม ซึ่งใช้สูตรเดียวกับ `promotionDiscountAmount` ฝั่ง Go — ถ้าอนาคตต้องเชื่อถือได้จริง ให้ backend คำนวณตอนสร้าง booking (นอกขอบเขตงานนี้)
