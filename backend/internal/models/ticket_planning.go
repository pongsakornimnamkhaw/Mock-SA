package models

import (
	"time"

	"gorm.io/gorm"
)

// LayoutObject stores editable objects for venue layouts and ticket designs.
// It belongs to a concert; a zone reference belongs in ObjectData so the
// database graph stays acyclic.
type LayoutObject struct {
	ObjectID       string  `gorm:"primaryKey;type:varchar(50);not null" json:"object_id"`
	ConcertID      string  `gorm:"type:varchar(50);not null;index" json:"concert_id"`
	ParentObjectID *string `gorm:"type:varchar(50);index" json:"parent_object_id,omitempty"`
	LayoutType     string  `gorm:"type:varchar(20);not null;check:layout_type IN ('VENUE','TICKET')" json:"layout_type"`
	SideType       *string `gorm:"type:varchar(20);check:side_type IS NULL OR side_type IN ('FRONT','BACK')" json:"side_type,omitempty"`
	ObjectType     string  `gorm:"type:varchar(50);not null" json:"object_type"`
	PositionX      float64 `gorm:"type:double precision;not null" json:"position_x"`
	PositionY      float64 `gorm:"type:double precision;not null" json:"position_y"`
	Width          float64 `gorm:"type:double precision;not null" json:"width"`
	Height         float64 `gorm:"type:double precision;not null" json:"height"`
	Rotation       float64 `gorm:"type:double precision;not null" json:"rotation"`
	LayerOrder     int     `gorm:"type:int;not null" json:"layer_order"`
	ObjectData     *string `gorm:"type:jsonb" json:"object_data,omitempty"`
	StyleJSON      *string `gorm:"type:jsonb" json:"style_json,omitempty"`

	Parent *LayoutObject `gorm:"foreignKey:ParentObjectID;references:ObjectID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"-"`
}

func (o *LayoutObject) BeforeCreate(tx *gorm.DB) error {
	if o.ObjectID == "" {
		o.ObjectID = GenerateID("LO")
	}
	return nil
}

// Publication stores one web-publication and sales window per concert.
type Publication struct {
	PublicationID        string     `gorm:"primaryKey;type:varchar(50);not null" json:"publication_id"`
	ConcertID            string     `gorm:"type:varchar(50);not null;uniqueIndex" json:"concert_id"`
	SaleOpenDate         *time.Time `gorm:"type:timestamp" json:"sale_open_date,omitempty"`
	BookingCloseDatetime *time.Time `gorm:"type:timestamp" json:"booking_close_datetime,omitempty"`
	OpenInWeb            *time.Time `gorm:"type:timestamp" json:"open_in_web,omitempty"`
	OutWeb               *time.Time `gorm:"type:timestamp" json:"out_web,omitempty"`
	Description          string     `gorm:"type:text" json:"description"`
	PosterWeb            []byte     `gorm:"type:bytea" json:"-"`

	BaseModel
}

func (p *Publication) BeforeCreate(tx *gorm.DB) error {
	if p.PublicationID == "" {
		p.PublicationID = GenerateID("PU")
	}
	return nil
}
