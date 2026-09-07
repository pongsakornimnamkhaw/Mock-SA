package handlers

import (
	"database/sql"
	"encoding/base64"
	"errors"
	"strings"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type customerPromotionConcertDTO struct {
	ConcertID   string `json:"concert_id"`
	ConcertName string `json:"concert_name"`
	StartDate   string `json:"start_date"`
	EndDate     string `json:"end_date"`
	StartTime   string `json:"start_time"`
	Location    string `json:"location"`
	Status      string `json:"status"`
	MoreInfo    string `json:"more_info,omitempty"`
	PosterData  string `json:"poster_data,omitempty"`
}

type customerPromotionDiscountDTO struct {
	Type              string  `json:"type"`
	Value             float64 `json:"value"`
	MaxDiscountAmount float64 `json:"max_discount_amount"`
	MinimumOrder      float64 `json:"minimum_order"`
	PromoCode         string  `json:"promo_code"`
}

type customerPromotionValidityDTO struct {
	StartDate      string `json:"start_date"`
	EndDate        string `json:"end_date"`
	TotalQuota     int    `json:"total_quota"`
	UsedQuota      int    `json:"used_quota"`
	RemainingQuota int    `json:"remaining_quota"`
}

type customerPromotionZoneDTO struct {
	ZoneID   string `json:"zone_id"`
	ZoneName string `json:"zone_name"`
}

type customerPromotionDTO struct {
	PromotionID    string                       `json:"promotion_id"`
	PromotionName  string                       `json:"promotion_name"`
	Description    string                       `json:"description"`
	BannerImageURL string                       `json:"banner_image_url"`
	Terms          string                       `json:"terms"`
	Discount       customerPromotionDiscountDTO `json:"discount"`
	Validity       customerPromotionValidityDTO `json:"validity"`
	Zones          []customerPromotionZoneDTO   `json:"zones"`
	Concert        customerPromotionConcertDTO  `json:"concert"`
}

func customerConcertView(concert models.Concert) customerPromotionConcertDTO {
	poster := concert.Poster
	if len(poster) == 0 {
		poster = concert.ConcertPoster
	}
	return customerPromotionConcertDTO{
		ConcertID: concert.ConcertID, ConcertName: concert.ConcertName,
		StartDate: dateOnly(concert.StartDate), EndDate: dateOnly(concert.EndDate),
		StartTime: clockOnly(concert.StartTime), Location: concert.Location,
		Status: concert.Status, MoreInfo: concert.MoreInfo, PosterData: encodeImageDataURL(poster),
	}
}

func encodeImageDataURL(data []byte) string {
	if len(data) == 0 {
		return ""
	}
	// Concert posters are stored as decoded image bytes. Promotion banners are
	// stored separately and already contain either a data URL or an HTTP URL.
	mime := "image/jpeg"
	if len(data) >= 8 && string(data[:8]) == "\x89PNG\r\n\x1a\n" {
		mime = "image/png"
	} else if len(data) >= 12 && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		mime = "image/webp"
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func customerConcertCancelled(status string) bool {
	normalized := strings.ToLower(strings.TrimSpace(status))
	return strings.Contains(normalized, "ยกเลิก") || normalized == "cancelled" || normalized == "canceled"
}

func customerPromotionView(p models.Promotion, concert models.Concert, now time.Time) (customerPromotionDTO, bool) {
	if p.Status != "active" || customerConcertCancelled(concert.Status) || len(p.DiscountInfos) == 0 || len(p.Quotas) == 0 || len(p.PromoConditions) == 0 || len(p.PromotionApprovals) == 0 {
		return customerPromotionDTO{}, false
	}
	// The latest approval is preloaded first. Checking it as well as p.Status
	// prevents inconsistent legacy records from being published accidentally.
	if p.PromotionApprovals[0].StatusApproved != "approved" {
		return customerPromotionDTO{}, false
	}
	quota := p.Quotas[0]
	today := now.In(promotionLocation).Format("2006-01-02")
	if quota.StartDate.Format("2006-01-02") > today || quota.EndDate.Format("2006-01-02") < today || quota.UsedQuota >= quota.TicketQuota {
		return customerPromotionDTO{}, false
	}
	discount, condition := p.DiscountInfos[0], p.PromoConditions[0]
	remaining := quota.TicketQuota - quota.UsedQuota
	zones := make([]customerPromotionZoneDTO, 0, len(p.Zones))
	for _, zone := range p.Zones {
		zones = append(zones, customerPromotionZoneDTO{ZoneID: zone.ZoneID, ZoneName: zone.ZoneType})
	}
	return customerPromotionDTO{
		PromotionID: p.PromotionID, PromotionName: p.PromotionName,
		Description: p.Description, BannerImageURL: string(p.BannerImageUrl),
		Terms: condition.ConditionDetail,
		Discount: customerPromotionDiscountDTO{
			Type: discount.DiscountType, Value: discount.DiscountValue,
			MaxDiscountAmount: discount.MaxDiscountAmount,
			MinimumOrder:      discount.MinOrderValue, PromoCode: discount.PromoCode,
		},
		Validity: customerPromotionValidityDTO{
			StartDate: quota.StartDate.Format("2006-01-02"), EndDate: quota.EndDate.Format("2006-01-02"),
			TotalQuota: quota.TicketQuota, UsedQuota: quota.UsedQuota, RemainingQuota: remaining,
		},
		Zones: zones, Concert: customerConcertView(concert),
	}, true
}

func customerPromotionRelations(db *gorm.DB) *gorm.DB {
	return db.Preload("DiscountInfos", func(q *gorm.DB) *gorm.DB { return q.Order("discount_id") }).
		Preload("Quotas", func(q *gorm.DB) *gorm.DB { return q.Order("quota_id") }).
		Preload("PromoConditions", func(q *gorm.DB) *gorm.DB { return q.Order("condition_id") }).
		Preload("Zones", func(q *gorm.DB) *gorm.DB { return q.Order("zone_id") }).
		Preload("PromotionApprovals", func(q *gorm.DB) *gorm.DB { return q.Order("requested_at DESC, approval_id DESC") })
}

func (h *customerAccountHandler) findCustomerPromotions(id, concertID string, now time.Time) ([]customerPromotionDTO, error) {
	result := make([]customerPromotionDTO, 0)
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var promotions []models.Promotion
		query := customerPromotionRelations(tx).Where("status = ?", "active")
		if id != "" {
			query = query.Where("promotion_id = ?", id)
		}
		if concertID != "" {
			query = query.Where("concert_id = ?", concertID)
		}
		if err := query.Order("created_at DESC, promotion_id DESC").Find(&promotions).Error; err != nil {
			return err
		}
		concertIDs := make([]string, 0, len(promotions))
		for _, promotion := range promotions {
			concertIDs = append(concertIDs, promotion.ConcertID)
		}
		concerts := make(map[string]models.Concert, len(concertIDs))
		if len(concertIDs) > 0 {
			var rows []models.Concert
			if err := tx.Where("concert_id IN ?", concertIDs).Find(&rows).Error; err != nil {
				return err
			}
			for _, concert := range rows {
				concerts[concert.ConcertID] = concert
			}
		}
		for _, promotion := range promotions {
			concert, ok := concerts[promotion.ConcertID]
			if !ok {
				continue
			}
			if view, visible := customerPromotionView(promotion, concert, now); visible {
				result = append(result, view)
			}
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return result, err
}

func (h *customerAccountHandler) listCustomerPromotions(c *fiber.Ctx) error {
	data, err := h.findCustomerPromotions("", strings.TrimSpace(c.Query("concert_id")), time.Now())
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดโปรโมชั่นได้")
	}
	return c.JSON(fiber.Map{"data": data})
}

func (h *customerAccountHandler) getCustomerPromotion(c *fiber.Ctx) error {
	data, err := h.findCustomerPromotions(strings.TrimSpace(c.Params("id")), "", time.Now())
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดโปรโมชั่นได้")
	}
	if len(data) == 0 {
		return customerError(c, fiber.StatusNotFound, "ไม่พบโปรโมชั่น หรือโปรโมชั่นนี้ไม่สามารถใช้งานได้แล้ว")
	}
	return c.JSON(fiber.Map{"data": data[0]})
}

func (h *customerAccountHandler) getCustomerConcert(c *fiber.Ctx) error {
	var concert models.Concert
	err := h.db.First(&concert, "concert_id = ?", strings.TrimSpace(c.Params("id"))).Error
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && customerConcertCancelled(concert.Status)) {
		return customerError(c, fiber.StatusNotFound, "ไม่พบคอนเสิร์ต")
	}
	if err != nil {
		return customerError(c, fiber.StatusInternalServerError, "ไม่สามารถโหลดคอนเสิร์ตได้")
	}
	return c.JSON(fiber.Map{"data": customerConcertView(concert)})
}
