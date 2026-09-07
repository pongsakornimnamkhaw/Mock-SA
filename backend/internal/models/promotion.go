package models

import (
	"time"

	"gorm.io/gorm"
)

// Promotion - โปรโมชั่น
type Promotion struct {
	PromotionID    string    `gorm:"primaryKey;type:varchar(50);not null" json:"promotion_id"`
	PromotionName  string    `gorm:"type:varchar(255);not null" json:"promotion_name"`
	Description    string    `gorm:"type:text;not null" json:"description"`
	BannerImageUrl []byte    `gorm:"type:bytea;not null" json:"banner_image_url,omitempty"`
	Status         string    `gorm:"type:varchar(50);not null" json:"status"`
	ZoneType       string    `gorm:"type:varchar(100);not null" json:"zone_type"`
	CreatedAt      time.Time `gorm:"autoCreateTime;not null" json:"created_at"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
	TotalRevenue   float64   `gorm:"type:double precision;not null" json:"total_revenue"`
	ConcertID      string    `gorm:"type:varchar(50);not null" json:"concert_id"`

	// Relations
	PromotionApprovals []PromotionApproval `gorm:"foreignKey:PromotionID" json:"promotion_approvals,omitempty"`
	PromoConditions    []PromoCondition    `gorm:"foreignKey:PromotionID" json:"promo_conditions,omitempty"`
	DiscountInfos      []DiscountInfo      `gorm:"foreignKey:PromotionID" json:"discount_infos,omitempty"`
	Quotas             []Quota             `gorm:"foreignKey:PromotionID" json:"quotas,omitempty"`
	Zones              []Zone              `gorm:"many2many:promotion_zones" json:"zones"`
	UsageLogs          []PromotionUsageLog `gorm:"foreignKey:PromotionID" json:"promotion_usage_logs"`
	TicketCategories   []TicketCategory    `gorm:"foreignKey:PromotionID" json:"ticket_categories,omitempty"`
}

func (p *Promotion) BeforeCreate(tx *gorm.DB) (err error) {
	if p.PromotionID == "" {
		p.PromotionID = GenerateID("PR")
	}
	return
}

// PromotionApproval - การอนุมัติโปรโมชั่น
type PromotionApproval struct {
	ApprovalID     string    `gorm:"primaryKey;type:varchar(50);not null" json:"approval_id"`
	RequestedBy    string    `gorm:"type:varchar(100);not null" json:"requested_by"`
	RequestedAt    time.Time `gorm:"type:timestamp;not null" json:"requested_at"`
	ApprovedBy     string    `gorm:"type:varchar(100);not null" json:"approved_by"`
	ApprovedAt     *time.Time `gorm:"type:timestamp" json:"approved_at"`
	StatusApproved string    `gorm:"type:varchar(50);not null" json:"status_approved"`
	Remark         string    `gorm:"type:text;not null" json:"remark"`
	UserID         *string   `gorm:"type:varchar(50)" json:"user_id"`
	PromotionID    string    `gorm:"type:varchar(50);not null" json:"promotion_id"`
}

func (a *PromotionApproval) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ApprovalID == "" {
		a.ApprovalID = GenerateID("PA")
	}
	return
}

// PromoCondition - เงื่อนไขโปรโมชั่น
type PromoCondition struct {
	ConditionID     string `gorm:"primaryKey;type:varchar(50);not null" json:"condition_id"`
	ConditionDetail string `gorm:"type:text;not null" json:"condition_detail"`
	MaxUsagePerUser int    `gorm:"type:int;not null" json:"max_usage_per_user"`
	PromotionID     string `gorm:"type:varchar(50);not null" json:"promotion_id"`
}

func (c *PromoCondition) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ConditionID == "" {
		c.ConditionID = GenerateID("PC")
	}
	return
}

// DiscountInfo - ข้อมูลส่วนลด
type DiscountInfo struct {
	DiscountID        string  `gorm:"primaryKey;type:varchar(50);not null" json:"discount_id"`
	DiscountType      string  `gorm:"type:varchar(100);not null" json:"discount_type"`
	DiscountValue     float64 `gorm:"type:double precision;not null" json:"discount_value"`
	MinOrderValue     float64 `gorm:"type:double precision;not null" json:"min_order_value"`
	MaxDiscountAmount float64 `gorm:"type:double precision;not null" json:"max_discount_amount"`
	PromoCode         string  `gorm:"type:varchar(100);not null" json:"promo_code"`
	PromotionID       string  `gorm:"type:varchar(50);not null" json:"promotion_id"`
}

func (d *DiscountInfo) BeforeCreate(tx *gorm.DB) (err error) {
	if d.DiscountID == "" {
		d.DiscountID = GenerateID("DI")
	}
	return
}

// Quota - โควต้าโปรโมชั่น
type Quota struct {
	QuotaID     string    `gorm:"primaryKey;type:varchar(50);not null" json:"quota_id"`
	StartDate   time.Time `gorm:"type:date;not null" json:"start_date"`
	EndDate     time.Time `gorm:"type:date;not null" json:"end_date"`
	TicketQuota int       `gorm:"type:int;not null" json:"ticket_quota"`
	UsedQuota   int       `gorm:"type:int;not null" json:"used_quota"`
	PromotionID string    `gorm:"type:varchar(50);not null" json:"promotion_id"`
}

func (q *Quota) BeforeCreate(tx *gorm.DB) (err error) {
	if q.QuotaID == "" {
		q.QuotaID = GenerateID("QT")
	}
	return
}

// PromotionUsageLog is populated by the booking/redemption workflow, not by page views.
type PromotionUsageLog struct {
	UsageLogID string `gorm:"primaryKey;type:varchar(50)" json:"usage_log_id"`
	UsedAt time.Time `gorm:"autoCreateTime" json:"used_at"`
	UserName string `json:"user_name"`
	UserID string `json:"user_id"`
	OrderID string `json:"order_id"`
	PurchasedZone string `json:"purchased_zone"`
	FinalAmount float64 `json:"final_amount"`
	DiscountAmount float64 `json:"discount_amount"`
	PromotionID string `gorm:"type:varchar(50);not null;index" json:"promotion_id"`
}
