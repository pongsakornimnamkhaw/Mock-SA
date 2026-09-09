package models

import (
	"gorm.io/gorm"
	"time"
)

// Artist - ข้อมูลศิลปิน
type Artist struct {
	ArtistID         string          `gorm:"primaryKey;type:varchar(50);not null" json:"artist_id"`
	ArtistName       string          `gorm:"type:varchar(255);not null" json:"artist_name"`
	RecordLabel      string          `gorm:"type:varchar(255);not null" json:"record_label"`
	OfficialContact  string          `gorm:"type:varchar(255);not null" json:"official_contact"`
	CoordinatorInfo  string          `gorm:"type:varchar(255);not null" json:"coordinator_info"`
	MoreInfo         string          `gorm:"type:text;not null" json:"more_info"`
	Status           string          `gorm:"type:varchar(50);not null" json:"status"`
	ArtistType       string          `gorm:"type:varchar(50);default:'เดี่ยว'" json:"artist_type"`
	CoordinatorName  string          `gorm:"type:varchar(255);default:''" json:"coordinator_name"`
	CoordinatorPhone string          `gorm:"type:varchar(50);default:''" json:"coordinator_phone"`
	CoordinatorEmail string          `gorm:"type:varchar(255);default:''" json:"coordinator_email"`
	Histories        []ArtistHistory `gorm:"foreignKey:ArtistID;references:ArtistID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`

	BaseModel
}

// ArtistHistory records changes made in the artist/performance module.
type ArtistHistory struct {
	HistoryID   string    `gorm:"primaryKey;type:varchar(50);not null" json:"history_id"`
	ArtistID    *string   `gorm:"type:varchar(50);index" json:"artist_id,omitempty"`
	EntityType  string    `gorm:"type:varchar(50);not null" json:"entity_type"`
	EntityID    string    `gorm:"type:varchar(50);not null" json:"entity_id"`
	Action      string    `gorm:"type:varchar(50);not null" json:"action"`
	Description string    `gorm:"type:text;not null" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime;not null" json:"created_at"`
}

func (h *ArtistHistory) BeforeCreate(tx *gorm.DB) (err error) {
	if h.HistoryID == "" {
		h.HistoryID = GenerateID("AH")
	}
	return
}

func (a *Artist) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ArtistID == "" {
		a.ArtistID = GenerateID("AR")
	}
	return
}

// ArtistRequirement - ความต้องการของศิลปิน
type ArtistRequirement struct {
	ArtistReqID string `gorm:"primaryKey;type:varchar(50);not null" json:"artist_req_id"`
	ArtistName  string `gorm:"type:varchar(255);not null" json:"artist_name"`
	ReqDate     string `gorm:"type:date;not null" json:"req_date"`
	StartReq    string `gorm:"type:time without time zone;not null" json:"start_req"`
	EndReq      string `gorm:"type:time without time zone;not null" json:"end_req"`
	Requirement string `gorm:"type:text;not null" json:"requirement"`
	ArtistID    string `gorm:"type:varchar(50);not null" json:"artist_id"`
	ConcertID   string `gorm:"type:varchar(50);not null;default:'';index" json:"concert_id"`
}

func (r *ArtistRequirement) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ArtistReqID == "" {
		r.ArtistReqID = GenerateID("RQ")
	}
	return
}
