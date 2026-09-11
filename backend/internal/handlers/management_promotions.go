package handlers

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const promotionBannerLimit = 5 * 1024 * 1024

var promotionLocation = time.FixedZone("Asia/Bangkok", 7*60*60)

type promotionConcertUI struct {
	ConcertID   string `json:"concert_id"`
	ConcertName string `json:"concert_name"`
	EventDate   string `json:"event_date"`
	Venue       string `json:"venue"`
}

type promotionZoneUI struct {
	ZoneID    string `json:"zone_id"`
	ZoneName  string `json:"zone_name"`
	ConcertID string `json:"concert_id"`
}

type promotionDiscountUI struct {
	DiscountID        string  `json:"discount_id"`
	DiscountType      string  `json:"discount_type"`
	DiscountValue     float64 `json:"discount_value"`
	MaxDiscountAmount float64 `json:"max_discount_amount"`
	PromoCode         string  `json:"promo_code"`
	PromotionID       string  `json:"promotion_id"`
}

type promotionQuotaUI struct {
	QuotaID     string `json:"quota_id"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	TotalQuota  int    `json:"total_quota"`
	UsedQuota   int    `json:"used_quota"`
	PromotionID string `json:"promotion_id"`
}

type promotionTermsUI struct {
	TermID      string `json:"term_id"`
	TermsDetail string `json:"terms_detail"`
	PromotionID string `json:"promotion_id"`
}

type promotionConditionUI struct {
	ConditionID     string  `json:"condition_id"`
	MaxUsagePerUser int     `json:"max_usage_per_user"`
	MinOrderAmount  float64 `json:"min_order_amount"`
	PromotionID     string  `json:"promotion_id"`
}

// PromotionApprovalUI deliberately uses status rather than status_approved.
// Pending approved_at is an empty string, matching the frontend string type.
type PromotionApprovalUI struct {
	ApprovalID  string `json:"approval_id"`
	RequestedBy string `json:"requested_by"`
	RequestedAt string `json:"requested_at"`
	ApprovedBy  string `json:"approved_by"`
	ApprovedAt  string `json:"approved_at"`
	Status      string `json:"status"`
	Remark      string `json:"remark"`
	PromotionID string `json:"promotion_id"`
}

// PromotionUI is the singular-relation view used by frontend/src/types/promotion.ts.
// Terms live in PromoCondition.ConditionDetail; minimum spend lives in DiscountInfo.
type PromotionUI struct {
	PromotionID        string                     `json:"promotion_id"`
	PromotionName      string                     `json:"promotion_name"`
	Description        string                     `json:"description"`
	BannerImageURL     string                     `json:"banner_image_url"`
	Status             string                     `json:"status"`
	ConcertID          string                     `json:"concert_id"`
	CreatedAt          string                     `json:"created_at"`
	UpdatedAt          string                     `json:"updated_at"`
	Concert            *promotionConcertUI        `json:"concert,omitempty"`
	DiscountInfo       *promotionDiscountUI       `json:"discount_info,omitempty"`
	QuotaAndPeriod     *promotionQuotaUI          `json:"quota_and_period,omitempty"`
	TermsAndConditions *promotionTermsUI          `json:"terms_and_conditions,omitempty"`
	PromotionCondition *promotionConditionUI      `json:"promotion_condition,omitempty"`
	UsageLogs          []models.PromotionUsageLog `json:"promotion_usage_logs"`
	Approvals          []PromotionApprovalUI      `json:"promotion_approvals"`
	Zones              []promotionZoneUI          `json:"zones"`
	TotalRevenue       float64                    `json:"total_revenue"`
	TotalDiscount      float64                    `json:"total_discount"`
}

type promotionPayload struct {
	PromotionName     string   `json:"promotion_name"`
	ConcertID         string   `json:"concert_id"`
	DiscountType      string   `json:"discount_type"`
	DiscountValue     *float64 `json:"discount_value"`
	MaxDiscountAmount *float64 `json:"max_discount_amount"`
	PromoCode         string   `json:"promo_code"`
	TermsDetail       string   `json:"terms_detail"`
	MaxUsagePerUser   *int     `json:"max_usage_per_user"`
	MinOrderAmount    *float64 `json:"min_order_amount"`
	StartDate         string   `json:"start_date"`
	EndDate           string   `json:"end_date"`
	TotalQuota        *int     `json:"total_quota"`
	SelectedZones     []string `json:"selected_zones"`
	BannerImageURL    string   `json:"banner_image_url"`
	RemoveBanner      bool     `json:"remove_banner"`
}

func promotionDecodeJSON(c *fiber.Ctx, target any) error {
	if !c.Is("json") || !strings.HasPrefix(strings.TrimSpace(string(c.Body())), "{") {
		return fiber.NewError(400, "ข้อมูลคำขอต้องเป็นออบเจ็กต์ JSON")
	}
	decoder := json.NewDecoder(bytes.NewReader(c.Body()))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fiber.NewError(400, "ฟิลด์หรือชนิดข้อมูล JSON ไม่ถูกต้อง กรุณาส่งค่าตัวเลขเป็นชนิดตัวเลข")
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return fiber.NewError(400, "ข้อมูลคำขอต้องมีออบเจ็กต์ JSON เพียงหนึ่งรายการ")
	}
	return nil
}

func (p *promotionPayload) validate() (time.Time, time.Time, error) {
	bad := func(message string) (time.Time, time.Time, error) {
		return time.Time{}, time.Time{}, fiber.NewError(400, message)
	}
	p.PromotionName = strings.TrimSpace(p.PromotionName)
	p.ConcertID = strings.TrimSpace(p.ConcertID)
	p.PromoCode = strings.TrimSpace(p.PromoCode)
	p.TermsDetail = strings.TrimSpace(p.TermsDetail)
	for _, field := range []struct {
		name, value string
		limit       int
	}{
		{"promotion_name", p.PromotionName, 255}, {"concert_id", p.ConcertID, 50},
		{"promo_code", p.PromoCode, 100}, {"terms_detail", p.TermsDetail, 100000},
	} {
		if field.value == "" || strings.ContainsRune(field.value, 0) || utf8.RuneCountInString(field.value) > field.limit {
			return bad("ต้องระบุ " + field.name + " โดยไม่มีอักขระต้องห้ามและมีความยาวไม่เกินที่กำหนด")
		}
	}
	if p.DiscountType != "percent" && p.DiscountType != "fixed" {
		return bad("discount_type ต้องเป็น percent หรือ fixed เท่านั้น")
	}
	for _, field := range []struct {
		name  string
		value *float64
	}{
		{"discount_value", p.DiscountValue}, {"max_discount_amount", p.MaxDiscountAmount},
		{"min_order_amount", p.MinOrderAmount},
	} {
		if field.value == nil || math.IsNaN(*field.value) || math.IsInf(*field.value, 0) || *field.value < 0 {
			return bad(field.name + " ต้องเป็นตัวเลขที่มีค่าจำกัดและไม่ติดลบ")
		}
	}
	if *p.DiscountValue <= 0 {
		return bad("discount_value ต้องมากกว่า 0")
	}
	if p.DiscountType == "percent" && *p.DiscountValue > 100 {
		return bad("ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100")
	}
	for _, field := range []struct {
		name  string
		value *int
	}{{"max_usage_per_user", p.MaxUsagePerUser}, {"total_quota", p.TotalQuota}} {
		if field.value == nil || *field.value < 1 || int64(*field.value) > math.MaxInt32 {
			return bad(field.name + " ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 2147483647")
		}
	}
	if *p.MaxUsagePerUser > *p.TotalQuota {
		return bad("max_usage_per_user ต้องไม่เกิน total_quota")
	}
	// SQL date columns are timezone-free calendar dates, not instants.
	start, err := time.Parse("2006-01-02", p.StartDate)
	if err != nil || start.Year() < 1 {
		return bad("start_date ต้องเป็นวันที่ที่ถูกต้องในรูปแบบ YYYY-MM-DD")
	}
	end, err := time.Parse("2006-01-02", p.EndDate)
	if err != nil || end.Year() < 1 || end.Before(start) {
		return bad("end_date ต้องเป็นวันที่ที่ถูกต้องในรูปแบบ YYYY-MM-DD และต้องไม่ก่อน start_date")
	}
	if len(p.SelectedZones) == 0 {
		return bad("กรุณาเลือกโซนใน selected_zones อย่างน้อยหนึ่งรายการ")
	}
	seen := make(map[string]bool, len(p.SelectedZones))
	for i, id := range p.SelectedZones {
		id = strings.TrimSpace(id)
		if id == "" || utf8.RuneCountInString(id) > 50 || strings.ContainsRune(id, 0) || seen[id] {
			return bad("selected_zones ต้องเป็นรหัสโซนที่ไม่ว่าง ไม่ซ้ำ ไม่มีอักขระต้องห้าม และยาวไม่เกิน 50 ตัวอักษร")
		}
		seen[id], p.SelectedZones[i] = true, id
	}
	sort.Strings(p.SelectedZones)
	return start, end, nil
}

// Uploaded data URLs are checked against their decoded bytes. Remote HTTP(S)
// URLs are kept as references and never fetched by the backend (no SSRF).
// Empty/omitted values mean keep the existing banner, not remove it.
func promotionBanner(value string, existing []byte) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		if existing == nil {
			return []byte{}, nil
		}
		return existing, nil
	}
	bad := func() ([]byte, error) {
		return nil, fiber.NewError(400, "แบนเนอร์ต้องเป็น URL แบบ HTTP(S) หรือ data URL ของภาพ PNG, JPEG หรือ WebP ที่ถูกต้อง ขนาดไม่เกิน 5 MB และไม่รองรับ blob URL")
	}
	if strings.HasPrefix(value, "data:") {
		header, encoded, ok := strings.Cut(value, ",")
		mime := strings.TrimSuffix(strings.TrimPrefix(header, "data:"), ";base64")
		if !ok || header != "data:"+mime+";base64" ||
			(mime != "image/png" && mime != "image/jpeg" && mime != "image/webp") ||
			len(encoded) > base64.StdEncoding.EncodedLen(promotionBannerLimit) {
			return bad()
		}
		data, err := base64.StdEncoding.Strict().DecodeString(encoded)
		if err != nil || len(data) == 0 || len(data) > promotionBannerLimit || http.DetectContentType(data) != mime {
			return bad()
		}
		if mime == "image/webp" {
			if !promotionValidWebP(data) {
				return bad()
			}
		} else {
			config, _, err := image.DecodeConfig(bytes.NewReader(data))
			// Bound decoder allocations even for small compressed image bombs.
			if err != nil || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > 25000000 {
				return bad()
			}
			if _, _, err = image.Decode(bytes.NewReader(data)); err != nil {
				return bad()
			}
		}
		return []byte("data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)), nil
	}
	u, err := url.Parse(value)
	if err != nil || len(value) > 8192 || (u.Scheme != "http" && u.Scheme != "https") || u.Hostname() == "" || u.User != nil {
		return bad()
	}
	return []byte(value), nil
}

// Validate the RIFF container and WebP image headers without introducing a new
// codec dependency. Unlike PNG/JPEG, WebP's compressed pixel stream is not decoded.
func promotionValidWebP(data []byte) bool {
	if len(data) < 20 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" || uint64(binary.LittleEndian.Uint32(data[4:8]))+8 != uint64(len(data)) {
		return false
	}
	imageFound := false
	for offset := 12; offset < len(data); {
		if len(data)-offset < 8 {
			return false
		}
		size := uint64(binary.LittleEndian.Uint32(data[offset+4 : offset+8]))
		end := uint64(offset) + 8 + size
		next := end + size%2
		if next > uint64(len(data)) {
			return false
		}
		chunk := data[offset+8 : int(end)]
		switch string(data[offset : offset+4]) {
		case "VP8 ":
			if len(chunk) < 10 || chunk[0]&1 != 0 || !bytes.Equal(chunk[3:6], []byte{0x9d, 0x01, 0x2a}) ||
				binary.LittleEndian.Uint16(chunk[6:8])&0x3fff == 0 || binary.LittleEndian.Uint16(chunk[8:10])&0x3fff == 0 {
				return false
			}
			imageFound = true
		case "VP8L":
			if len(chunk) < 5 || chunk[0] != 0x2f || chunk[4]&0xe0 != 0 {
				return false
			}
			imageFound = true
		case "VP8X":
			if len(chunk) != 10 {
				return false
			}
		case "ANMF":
			if len(chunk) < 24 {
				return false
			}
			// A frame contains its own ALPH/VP8/VP8L chunks after a 16-byte header.
			frame := make([]byte, 12, 12+len(chunk)-16)
			copy(frame, "RIFF")
			copy(frame[8:], "WEBP")
			frame = append(frame, chunk[16:]...)
			binary.LittleEndian.PutUint32(frame[4:8], uint32(len(frame)-8))
			// Do not allow recursively nested animation frames.
			if bytes.Contains(chunk[16:], []byte("ANMF")) || !promotionValidWebP(frame) {
				return false
			}
			imageFound = true
		}
		offset = int(next)
	}
	return imageFound
}

func promotionApprovalView(a models.PromotionApproval) PromotionApprovalUI {
	view := PromotionApprovalUI{
		ApprovalID: a.ApprovalID, RequestedBy: a.RequestedBy, RequestedAt: a.RequestedAt.Format(time.RFC3339Nano),
		ApprovedBy: a.ApprovedBy, Status: a.StatusApproved, Remark: a.Remark, PromotionID: a.PromotionID,
	}
	if a.ApprovedAt != nil {
		view.ApprovedAt = a.ApprovedAt.Format(time.RFC3339Nano)
	}
	return view
}

func promotionConcertView(c models.Concert) promotionConcertUI {
	return promotionConcertUI{ConcertID: c.ConcertID, ConcertName: c.ConcertName, EventDate: dateOnly(c.StartDate), Venue: c.Location}
}

func promotionView(p models.Promotion, concerts map[string]promotionConcertUI, now time.Time) PromotionUI {
	view := PromotionUI{
		PromotionID: p.PromotionID, PromotionName: p.PromotionName, Description: p.Description,
		BannerImageURL: string(p.BannerImageUrl), Status: p.Status, ConcertID: p.ConcertID,
		CreatedAt: p.CreatedAt.Format(time.RFC3339Nano), UpdatedAt: p.UpdatedAt.Format(time.RFC3339Nano),
		TotalRevenue: p.TotalRevenue, Zones: []promotionZoneUI{}, Approvals: []PromotionApprovalUI{},
		UsageLogs: append([]models.PromotionUsageLog{}, p.UsageLogs...),
	}
	if concert, ok := concerts[p.ConcertID]; ok {
		view.Concert = &concert
	}
	if len(p.DiscountInfos) > 0 {
		d := p.DiscountInfos[0]
		view.DiscountInfo = &promotionDiscountUI{d.DiscountID, d.DiscountType, d.DiscountValue, d.MaxDiscountAmount, d.PromoCode, p.PromotionID}
	}
	if len(p.Quotas) > 0 {
		q := p.Quotas[0]
		view.QuotaAndPeriod = &promotionQuotaUI{q.QuotaID, q.StartDate.Format("2006-01-02"), q.EndDate.Format("2006-01-02"), q.TicketQuota, q.UsedQuota, p.PromotionID}
		// Approval controls active/draft. Expiry is derived without changing history;
		// the end date remains usable through 23:59:59 Bangkok time.
		if view.Status == "active" && q.EndDate.Format("2006-01-02") < now.In(promotionLocation).Format("2006-01-02") {
			view.Status = "expired"
		}
	}
	if len(p.PromoConditions) > 0 {
		condition := p.PromoConditions[0]
		view.TermsAndConditions = &promotionTermsUI{condition.ConditionID, condition.ConditionDetail, p.PromotionID}
		view.PromotionCondition = &promotionConditionUI{ConditionID: condition.ConditionID, MaxUsagePerUser: condition.MaxUsagePerUser, PromotionID: p.PromotionID}
		if len(p.DiscountInfos) > 0 {
			view.PromotionCondition.MinOrderAmount = p.DiscountInfos[0].MinOrderValue
		}
	}
	for _, zone := range p.Zones {
		view.Zones = append(view.Zones, promotionZoneUI{
			ZoneID: zone.ZoneID, ZoneName: zone.ZoneType, ConcertID: zone.ConcertID,
		})
	}
	for _, approval := range p.PromotionApprovals {
		view.Approvals = append(view.Approvals, promotionApprovalView(approval))
	}
	for _, usage := range p.UsageLogs {
		view.TotalDiscount += usage.DiscountAmount
	}
	return view
}

func promotionRelations(db *gorm.DB) *gorm.DB {
	// Stable ordering makes the singular mapping deterministic for legacy arrays.
	return db.Preload("DiscountInfos", func(q *gorm.DB) *gorm.DB { return q.Order("discount_id") }).
		Preload("Quotas", func(q *gorm.DB) *gorm.DB { return q.Order("quota_id") }).
		Preload("PromoConditions", func(q *gorm.DB) *gorm.DB { return q.Order("condition_id") }).
		Preload("Zones", func(q *gorm.DB) *gorm.DB { return q.Order("zone_id") }).
		Preload("PromotionApprovals", func(q *gorm.DB) *gorm.DB { return q.Order("requested_at DESC, approval_id DESC") }).
		Preload("UsageLogs", func(q *gorm.DB) *gorm.DB { return q.Order("used_at DESC, usage_log_id DESC") })
}

func promotionConcerts(db *gorm.DB, promotions []models.Promotion) (map[string]promotionConcertUI, error) {
	views := make(map[string]promotionConcertUI)
	ids := make([]string, 0, len(promotions))
	for _, p := range promotions {
		ids = append(ids, p.ConcertID)
	}
	if len(ids) == 0 {
		return views, nil
	}
	var concerts []models.Concert
	if err := db.Select("concert_id", "concert_name", "start_date", "location").Where("concert_id IN ?", ids).Find(&concerts).Error; err != nil {
		return nil, err
	}
	for _, concert := range concerts {
		views[concert.ConcertID] = promotionConcertView(concert)
	}
	return views, nil
}

func (h *managementHandler) promotionOptions(c *fiber.Ctx) error {
	concerts, zones := []promotionConcertUI{}, []promotionZoneUI{}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var concertModels []models.Concert
		if err := tx.Select("concert_id", "concert_name", "start_date", "location").Order("start_date, concert_id").Find(&concertModels).Error; err != nil {
			return err
		}
		for _, concert := range concertModels {
			concerts = append(concerts, promotionConcertView(concert))
		}
		var zoneModels []models.Zone
		if err := tx.Order("zone_type, zone_id").Find(&zoneModels).Error; err != nil {
			return err
		}
		for _, zone := range zoneModels {
			zones = append(zones, promotionZoneUI{
				ZoneID: zone.ZoneID, ZoneName: zone.ZoneType, ConcertID: zone.ConcertID,
			})
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return managementError(c, err)
	}
	return c.JSON(fiber.Map{"concerts": concerts, "zones": zones})
}

func (h *managementHandler) listPromotions(c *fiber.Ctx) error {
	data := []PromotionUI{}
	var summary struct {
		ActivePromotionCount int     `json:"active_promotion_count"`
		TotalRevenue         float64 `json:"total_revenue"`
		TotalRedemptions     int64   `json:"total_redemptions"`
	}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var promotions []models.Promotion
		if err := promotionRelations(tx).Order("created_at DESC, promotion_id DESC").Find(&promotions).Error; err != nil {
			return err
		}
		concerts, err := promotionConcerts(tx, promotions)
		if err != nil {
			return err
		}
		now := time.Now()
		for _, promotion := range promotions {
			view := promotionView(promotion, concerts, now)
			data = append(data, view)
			if view.Status == "active" {
				summary.ActivePromotionCount++
			}
			summary.TotalRevenue += promotion.TotalRevenue
			for _, quota := range promotion.Quotas {
				summary.TotalRedemptions += int64(quota.UsedQuota)
			}
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return managementError(c, err)
	}
	return c.JSON(fiber.Map{"data": data, "summary": summary})
}

func promotionReadView(tx *gorm.DB, id string) (PromotionUI, error) {
	var promotion models.Promotion
	if err := promotionRelations(tx).Where("promotion_id = ?", id).First(&promotion).Error; err != nil {
		return PromotionUI{}, err
	}
	concerts, err := promotionConcerts(tx, []models.Promotion{promotion})
	if err != nil {
		return PromotionUI{}, err
	}
	return promotionView(promotion, concerts, time.Now()), nil
}

func (h *managementHandler) getPromotion(c *fiber.Ctx) error {
	var view PromotionUI
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var err error
		view, err = promotionReadView(tx, c.Params("id"))
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return managementError(c, err)
	}
	return c.JSON(view)
}

// Every writer locks the parent before locking children. Decision first performs
// an unlocked lookup only to find that parent, then rechecks the locked approval.
func promotionLock(tx *gorm.DB, id string) (models.Promotion, error) {
	var promotion models.Promotion
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("promotion_id = ?", id).First(&promotion).Error
	return promotion, err
}

func promotionChanged(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fiber.NewError(409, "ข้อมูลโปรโมชั่นหรือคำขออนุมัติมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่ก่อนลองอีกครั้ง")
	}
	return nil
}

// The frontend has only pending/approved/rejected. Resolve obsolete requests as
// rejected, explicitly explaining the cancellation; never delete decided history.
// Approval timestamps have no timezone in PostgreSQL and are read back as UTC.
// Normalize every approval write, including cancellation callers, to UTC wall time.
func promotionResolvePending(tx *gorm.DB, id, remark string, now time.Time) error {
	return tx.Model(&models.PromotionApproval{}).Where("promotion_id = ? AND status_approved = ?", id, "pending").
		Updates(map[string]any{"status_approved": "rejected", "remark": remark, "approved_at": now.UTC(), "approved_by": unidentifiedActor, "user_id": nil}).Error
}

func promotionReferences(tx *gorm.DB, p promotionPayload) ([]models.Zone, error) {
	var concert models.Concert
	// KEY SHARE prevents hard deletes of these references until this write commits.
	if err := tx.Clauses(clause.Locking{Strength: "KEY SHARE"}).Where("concert_id = ?", p.ConcertID).First(&concert).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fiber.NewError(400, "ไม่พบคอนเสิร์ตที่อ้างอิงโดย concert_id")
		}
		return nil, err
	}
	var zones []models.Zone
	if err := tx.Clauses(clause.Locking{Strength: "KEY SHARE"}).Where("zone_id IN ?", p.SelectedZones).Order("zone_id").Find(&zones).Error; err != nil {
		return nil, err
	}
	if len(zones) != len(p.SelectedZones) {
		return nil, fiber.NewError(400, "ไม่พบโซนบางรายการที่ระบุใน selected_zones")
	}
	if err := validatePromotionZonesForConcert(p.ConcertID, p.SelectedZones, zones); err != nil {
		return nil, err
	}
	return zones, nil
}

func validatePromotionZonesForConcert(concertID string, selectedZoneIDs []string, zones []models.Zone) error {
	if len(zones) != len(selectedZoneIDs) {
		return fiber.NewError(400, "ไม่พบโซนบางรายการที่ระบุใน selected_zones")
	}
	for _, zone := range zones {
		if zone.ConcertID != concertID {
			return fiber.NewError(400, "โซนที่เลือกต้องเป็นของคอนเสิร์ตเดียวกับ concert_id")
		}
	}
	return nil
}

func promotionUniqueCode(tx *gorm.DB, code, id string) error {
	// Use PostgreSQL's own case folding for BOTH the lock key and lookup. A hash
	// collision only serializes unrelated codes. No schema mutation/unique-index
	// migration is needed. All future code writers must use this protocol too.
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended('management-promo-code:' || UPPER(BTRIM(CAST(? AS text))), 0))", code).Error; err != nil {
		return err
	}
	var count int64
	// Deleted promotions retain their codes for historical redemption references.
	if err := tx.Model(&models.DiscountInfo{}).
		Where("UPPER(BTRIM(promo_code)) = UPPER(BTRIM(CAST(? AS text))) AND promotion_id <> ?", code, id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fiber.NewError(409, "promo_code นี้ถูกใช้แล้ว รวมถึงรหัสของโปรโมชั่นที่ลบไปแล้ว")
	}
	return nil
}

func promotionSaveRelations(tx *gorm.DB, promotion models.Promotion, p promotionPayload, start, end time.Time) error {
	var discounts []models.DiscountInfo
	var conditions []models.PromoCondition
	var quotas []models.Quota
	lock := clause.Locking{Strength: "UPDATE"}
	if err := tx.Clauses(lock).Where("promotion_id = ?", promotion.PromotionID).Order("discount_id").Find(&discounts).Error; err != nil {
		return err
	}
	if err := tx.Clauses(lock).Where("promotion_id = ?", promotion.PromotionID).Order("condition_id").Find(&conditions).Error; err != nil {
		return err
	}
	if err := tx.Clauses(lock).Where("promotion_id = ?", promotion.PromotionID).Order("quota_id").Find(&quotas).Error; err != nil {
		return err
	}
	// Do not silently discard legacy multi-row data to force a singular UI shape.
	if len(discounts) > 1 || len(conditions) > 1 || len(quotas) > 1 {
		return fiber.NewError(409, "โปรโมชั่นมีข้อมูลส่วนลด เงื่อนไข หรือโควต้าหลายรายการ กรุณาตรวจสอบและจัดข้อมูลให้เหลือประเภทละหนึ่งรายการก่อนแก้ไข")
	}
	var usageCount int64
	if err := tx.Model(&models.PromotionUsageLog{}).Where("promotion_id = ?", promotion.PromotionID).Count(&usageCount).Error; err != nil {
		return err
	}
	if usageCount > int64(*p.TotalQuota) || (len(quotas) == 1 && quotas[0].UsedQuota > *p.TotalQuota) {
		return fiber.NewError(400, "total_quota ต้องไม่น้อยกว่าจำนวนสิทธิ์ที่ใช้ไปแล้ว")
	}
	d := models.DiscountInfo{PromotionID: promotion.PromotionID, DiscountType: p.DiscountType, DiscountValue: *p.DiscountValue,
		MinOrderValue: *p.MinOrderAmount, MaxDiscountAmount: *p.MaxDiscountAmount, PromoCode: p.PromoCode}
	if len(discounts) == 0 {
		d.DiscountID = "DI" + uuid.NewString()
		if err := tx.Create(&d).Error; err != nil {
			return err
		}
	} else if err := promotionChanged(tx.Model(&models.DiscountInfo{}).Where("discount_id = ? AND promotion_id = ?", discounts[0].DiscountID, promotion.PromotionID).
		Updates(map[string]any{"discount_type": d.DiscountType, "discount_value": d.DiscountValue, "min_order_value": d.MinOrderValue,
			"max_discount_amount": d.MaxDiscountAmount, "promo_code": d.PromoCode})); err != nil {
		return err
	}
	condition := models.PromoCondition{PromotionID: promotion.PromotionID, ConditionDetail: p.TermsDetail, MaxUsagePerUser: *p.MaxUsagePerUser}
	if len(conditions) == 0 {
		condition.ConditionID = "PC" + uuid.NewString()
		if err := tx.Create(&condition).Error; err != nil {
			return err
		}
	} else if err := promotionChanged(tx.Model(&models.PromoCondition{}).Where("condition_id = ? AND promotion_id = ?", conditions[0].ConditionID, promotion.PromotionID).
		Updates(map[string]any{"condition_detail": condition.ConditionDetail, "max_usage_per_user": condition.MaxUsagePerUser})); err != nil {
		return err
	}
	if len(quotas) == 0 {
		return tx.Create(&models.Quota{QuotaID: "QT" + uuid.NewString(), PromotionID: promotion.PromotionID, StartDate: start, EndDate: end, TicketQuota: *p.TotalQuota}).Error
	}
	// Never overwrite UsedQuota from a payload or an earlier read.
	return promotionChanged(tx.Model(&models.Quota{}).
		Where("quota_id = ? AND promotion_id = ? AND used_quota <= ?", quotas[0].QuotaID, promotion.PromotionID, *p.TotalQuota).
		Updates(map[string]any{"start_date": start, "end_date": end, "ticket_quota": *p.TotalQuota}))
}

func (h *managementHandler) savePromotion(c *fiber.Ctx) error {
	var payload promotionPayload
	if err := promotionDecodeJSON(c, &payload); err != nil {
		return managementError(c, err)
	}
	start, end, err := payload.validate()
	if err != nil {
		return managementError(c, err)
	}
	// Expensive image validation happens before taking any database locks.
	banner, err := promotionBanner(payload.BannerImageURL, nil)
	if err != nil {
		return managementError(c, err)
	}
	creating := c.Method() == fiber.MethodPost
	var view PromotionUI
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var promotion models.Promotion
		if !creating {
			var err error
			promotion, err = promotionLock(tx, c.Params("id"))
			if err != nil {
				return err
			}
			if strings.TrimSpace(payload.BannerImageURL) == "" && !payload.RemoveBanner {
				banner = promotion.BannerImageUrl
			}
		}
		if err := promotionUniqueCode(tx, payload.PromoCode, promotion.PromotionID); err != nil {
			return err
		}
		zones, err := promotionReferences(tx, payload)
		if err != nil {
			return err
		}
		now := time.Now()
		zoneType := "multiple"
		if len(zones) == 1 {
			zoneType = zones[0].ZoneType
		}
		if creating {
			promotion = models.Promotion{PromotionID: "PR" + uuid.NewString(), PromotionName: payload.PromotionName, Description: payload.TermsDetail,
				BannerImageUrl: banner, Status: "draft", ZoneType: zoneType, ConcertID: payload.ConcertID}
			if err := tx.Create(&promotion).Error; err != nil {
				return err
			}
		} else {
			if err := promotionChanged(tx.Model(&models.Promotion{}).Where("promotion_id = ? AND status = ?", promotion.PromotionID, promotion.Status).
				Updates(map[string]any{"promotion_name": payload.PromotionName, "description": payload.TermsDetail, "banner_image_url": banner,
					"status": "draft", "zone_type": zoneType, "concert_id": payload.ConcertID, "updated_at": now})); err != nil {
				return err
			}
		}
		if err := promotionSaveRelations(tx, promotion, payload, start, end); err != nil {
			return err
		}
		// Replace only the join rows; never save/update/delete the referenced zones.
		if err := tx.Model(&promotion).Omit("Zones.*").Association("Zones").Replace(zones); err != nil {
			return err
		}
		if err := promotionResolvePending(tx, promotion.PromotionID, "ยกเลิกอัตโนมัติ: โปรโมชั่นได้รับการแก้ไขและมีคำขออนุมัติใหม่แทนคำขอเดิม", now); err != nil {
			return err
		}
		if err := tx.Create(&models.PromotionApproval{ApprovalID: "PA" + uuid.NewString(), PromotionID: promotion.PromotionID, RequestedBy: unidentifiedActor, RequestedAt: now.UTC(),
			StatusApproved: "pending", ApprovedBy: "", UserID: nil, Remark: ""}).Error; err != nil {
			return err
		}
		action := "UPDATE_PROMOTION"
		if creating {
			action = "CREATE_PROMOTION"
		}
		if err := auditManagement(tx, action, promotion.PromotionID, fmt.Sprintf("%s: %s; บันทึกเป็นฉบับร่างและส่งคำขออนุมัติแล้ว", unidentifiedActor, payload.PromotionName)); err != nil {
			return err
		}
		view, err = promotionReadView(tx, promotion.PromotionID)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return managementError(c, err)
	}
	if creating {
		return c.Status(fiber.StatusCreated).JSON(view)
	}
	return c.JSON(view)
}

func (h *managementHandler) deletePromotion(c *fiber.Ctx) error {
	err := h.db.Transaction(func(tx *gorm.DB) error {
		promotion, err := promotionLock(tx, c.Params("id"))
		if err != nil {
			return err
		}
		if err := promotionResolvePending(tx, promotion.PromotionID, "ยกเลิกอัตโนมัติ: โปรโมชั่นถูกลบแล้ว", time.Now()); err != nil {
			return err
		}
		if err := promotionChanged(tx.Where("promotion_id = ?", promotion.PromotionID).Delete(&models.Promotion{})); err != nil {
			return err
		}
		return auditManagement(tx, "DELETE_PROMOTION", promotion.PromotionID, unidentifiedActor+": ลบโปรโมชั่น "+promotion.PromotionName+" โดยเก็บข้อมูลอ้างอิงและประวัติไว้")
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return managementError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *managementHandler) listApprovals(c *fiber.Ctx) error {
	type approvalEntry struct {
		Approval  PromotionApprovalUI `json:"approval"`
		Promotion PromotionUI         `json:"promotion"`
	}
	data := []approvalEntry{}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var approvals []models.PromotionApproval
		if err := tx.Order("requested_at DESC, approval_id DESC").Find(&approvals).Error; err != nil {
			return err
		}
		if len(approvals) == 0 {
			return nil
		}
		ids := make([]string, 0, len(approvals))
		for _, approval := range approvals {
			ids = append(ids, approval.PromotionID)
		}
		var promotions []models.Promotion
		// Archived promotion history stays visible even though its detail route is 404.
		if err := promotionRelations(tx.Unscoped()).Where("promotion_id IN ?", ids).Find(&promotions).Error; err != nil {
			return err
		}
		concerts, err := promotionConcerts(tx, promotions)
		if err != nil {
			return err
		}
		views := make(map[string]PromotionUI, len(promotions))
		now := time.Now()
		for _, promotion := range promotions {
			views[promotion.PromotionID] = promotionView(promotion, concerts, now)
		}
		for _, approval := range approvals {
			if promotion, ok := views[approval.PromotionID]; ok {
				data = append(data, approvalEntry{promotionApprovalView(approval), promotion})
			}
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return managementError(c, err)
	}
	return c.JSON(fiber.Map{"data": data})
}

func (h *managementHandler) decideApproval(c *fiber.Ctx) error {
	var payload struct {
		Status string  `json:"status"`
		Remark *string `json:"remark"`
	}
	if err := promotionDecodeJSON(c, &payload); err != nil {
		return managementError(c, err)
	}
	if (payload.Status != "approved" && payload.Status != "rejected") || payload.Remark == nil ||
		strings.ContainsRune(*payload.Remark, 0) || utf8.RuneCountInString(*payload.Remark) > 100000 {
		return managementError(c, fiber.NewError(400, "status ต้องเป็น approved หรือ rejected และ remark ต้องเป็นข้อความที่ไม่มีอักขระต้องห้ามและยาวไม่เกิน 100000 ตัวอักษร"))
	}
	decisionLabel := "อนุมัติ"
	if payload.Status == "rejected" {
		decisionLabel = "ปฏิเสธ"
	}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var lookup models.PromotionApproval
		if err := tx.Select("approval_id", "promotion_id").Where("approval_id = ?", c.Params("id")).First(&lookup).Error; err != nil {
			return err
		}
		promotion, err := promotionLock(tx, lookup.PromotionID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fiber.NewError(409, "คำขออนุมัตินี้เป็นของโปรโมชั่นที่ถูกลบหรือไม่พบในระบบ")
		}
		if err != nil {
			return err
		}
		var approval models.PromotionApproval
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("approval_id = ? AND promotion_id = ?", lookup.ApprovalID, promotion.PromotionID).First(&approval).Error; err != nil {
			return err
		}
		if approval.StatusApproved != "pending" || promotion.Status != "draft" {
			return fiber.NewError(409, "คำขอนี้ได้รับการพิจารณาแล้ว ถูกแทนที่ หรือไม่ได้อยู่ในสถานะรออนุมัติ")
		}
		// A legacy duplicate pending request must not approve a superseded version.
		var latest models.PromotionApproval
		if err := tx.Where("promotion_id = ?", promotion.PromotionID).Order("requested_at DESC, approval_id DESC").First(&latest).Error; err != nil {
			return err
		}
		if latest.ApprovalID != approval.ApprovalID {
			return fiber.NewError(409, "คำขอนี้ถูกแทนที่ด้วยคำขออนุมัติใหม่แล้ว")
		}
		now := time.Now()
		if err := promotionChanged(tx.Model(&models.PromotionApproval{}).
			Where("approval_id = ? AND promotion_id = ? AND status_approved = ?", approval.ApprovalID, promotion.PromotionID, "pending").
			Updates(map[string]any{"status_approved": payload.Status, "remark": strings.TrimSpace(*payload.Remark),
				"approved_by": unidentifiedActor, "approved_at": now.UTC(), "user_id": nil})); err != nil {
			return err
		}
		status := "draft"
		if payload.Status == "approved" {
			status = "active"
		}
		if err := promotionChanged(tx.Model(&models.Promotion{}).Where("promotion_id = ? AND status = ?", promotion.PromotionID, "draft").
			Updates(map[string]any{"status": status, "updated_at": now})); err != nil {
			return err
		}
		if err := promotionResolvePending(tx, promotion.PromotionID, "ยกเลิกอัตโนมัติ: คำขออนุมัติล่าสุดได้รับการพิจารณาแล้ว จึงยกเลิกคำขอเดิมที่ยังค้างอยู่", now); err != nil {
			return err
		}
		actionCode := "REJECT_PROMOTION"
		if payload.Status == "approved" {
			actionCode = "APPROVE_PROMOTION"
		}
		return auditManagement(tx, actionCode, promotion.PromotionID,
			fmt.Sprintf("%s: %sคำขอ %s; %s", unidentifiedActor, decisionLabel, approval.ApprovalID, strings.TrimSpace(*payload.Remark)))
	}, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return managementError(c, err)
	}
	return c.JSON(fiber.Map{"message": decisionLabel + "โปรโมชั่นเรียบร้อยแล้ว"})
}
