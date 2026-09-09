package models

import (
	"time"

	"gorm.io/gorm"
)

type Publication struct {
	PublicationID        string     `gorm:"column:publication_id;primaryKey;type:varchar(50);not null" json:"publication_id"`
	ConcertID            string     `gorm:"column:concert_id;type:varchar(50);not null;uniqueIndex" json:"concert_id"`
	SaleOpenDate         *time.Time `gorm:"column:sale_open_date;type:timestamp" json:"sale_open_date,omitempty"`
	BookingCloseDatetime *time.Time `gorm:"column:booking_close_datetime;type:timestamp" json:"booking_close_datetime,omitempty"`
	OpenInWeb            *time.Time `gorm:"column:open_in_web;type:timestamp" json:"open_in_web,omitempty"`
	OutWeb               *time.Time `gorm:"column:out_web;type:timestamp" json:"out_web,omitempty"`
	Description          string     `gorm:"column:description;type:text" json:"description"`
	PosterWeb            string     `gorm:"column:poster_web;type:varchar(1000)" json:"poster_web"`

	BaseModel
}

func (Publication) TableName() string { return "Publication" }

func (p *Publication) BeforeCreate(tx *gorm.DB) error {
	if p.PublicationID == "" {
		p.PublicationID = GenerateID("PU")
	}
	return nil
}
