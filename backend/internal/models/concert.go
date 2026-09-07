package models

import (
	"time"

	"gorm.io/gorm"
)

// Concert - ข้อมูลงานคอนเสิร์ต
type Concert struct {
	ConcertID     string       `gorm:"primaryKey;type:varchar(50);not null" json:"concert_id"`
	ConcertName   string       `gorm:"type:varchar(255);not null" json:"concert_name"`
	StartDate     string       `gorm:"type:date;not null" json:"start_date"`
	EndDate       string       `gorm:"type:date;not null" json:"end_date"`
	StartTime     string       `gorm:"type:time without time zone;not null" json:"start_time"`
	EndTime       string       `gorm:"type:time without time zone;not null" json:"end_time"`
	TimeOpenGate  string       `gorm:"column:time_open_gate;type:time without time zone;not null;default:'00:00:00'" json:"time_open_gate"`
	Location      string       `gorm:"type:varchar(255);not null" json:"location"`
	Status        string       `gorm:"type:varchar(50);not null" json:"status"`
	ConcertPoster []byte       `gorm:"type:bytea" json:"concert_poster,omitempty"`
	Poster        []byte       `gorm:"type:bytea" json:"poster,omitempty"`
	MoreInfo      string       `gorm:"type:text;not null" json:"more_info"`
	LayoutObjects JSONDocument `gorm:"type:jsonb;not null;default:'[]'" json:"-"`

	Publication *Publication `gorm:"foreignKey:ConcertID" json:"-"`
	Zones       []Zone       `gorm:"foreignKey:ConcertID" json:"-"`
	Seats       []Seat       `gorm:"foreignKey:ConcertID" json:"-"`

	BaseModel
}

// Publication contains the editable publication settings for one concert.
type Publication struct {
	PublicationID        uint       `gorm:"primaryKey;autoIncrement" json:"publication_id"`
	SaleOpenDate         *time.Time `gorm:"type:timestamp" json:"sale_open_date"`
	BookingCloseDatetime *time.Time `gorm:"type:timestamp" json:"booking_close_datetime"`
	OpenInWeb            *time.Time `gorm:"column:openinweb;type:timestamp" json:"openinweb"`
	Describtion          string     `gorm:"type:text;not null;default:''" json:"description"`
	OutWeb               *time.Time `gorm:"column:outweb;type:timestamp" json:"outweb"`
	PosterWeb            []byte     `gorm:"type:bytea" json:"-"`
	ConcertID            string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"concert_id"`

	BaseModel
}

func (c *Concert) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ConcertID == "" {
		c.ConcertID = GenerateID("CC")
	}
	return
}

// ConcertArtist - ตารางกลาง Concert <-> Artist (many2many)
type ConcertArtist struct {
	ConcertID        string `gorm:"primaryKey;type:varchar(50);not null" json:"concert_id"`
	ArtistID         string `gorm:"primaryKey;type:varchar(50);not null" json:"artist_id"`
	InvitationStatus string `gorm:"type:varchar(50);not null;default:'รอการตอบรับ'" json:"invitation_status"`
}

// ConcertDocument - เอกสารของงานคอนเสิร์ต
type ConcertDocument struct {
	DocumentID   string `gorm:"primaryKey;type:varchar(50);not null" json:"document_id"`
	Category     string `gorm:"type:varchar(100);not null" json:"category"`
	DocumentName string `gorm:"type:text;not null" json:"document_name"`
	DocumentFile []byte `gorm:"type:bytea" json:"document_file,omitempty"`
	ConcertID    string `gorm:"type:varchar(50);not null" json:"concert_id"`
}

func (d *ConcertDocument) BeforeCreate(tx *gorm.DB) (err error) {
	if d.DocumentID == "" {
		d.DocumentID = GenerateID("CD")
	}
	return
}

// ModifiedHistory - ประวัติการแก้ไข
type ModifiedHistory struct {
	HistoryID   string    `gorm:"primaryKey;type:varchar(50);not null" json:"history_id"`
	ActionType  string    `gorm:"type:varchar(100);not null" json:"action_type"`
	Description string    `gorm:"type:text;not null" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime;not null" json:"created_at"`
	ConcertID   string    `gorm:"type:varchar(50);not null" json:"concert_id"`
}

func (m *ModifiedHistory) BeforeCreate(tx *gorm.DB) (err error) {
	if m.HistoryID == "" {
		m.HistoryID = GenerateID("MH")
	}
	return
}

// SummaryReport - สรุปรายงานหลังจบคอนเสิร์ต
type SummaryReport struct {
	ReportID      string    `gorm:"primaryKey;type:varchar(50);not null" json:"report_id"`
	GeneratedDate time.Time `gorm:"type:date;not null" json:"generated_date"`
	FileFormat    []byte    `gorm:"type:bytea;not null" json:"file_format,omitempty"`
	ConcertID     string    `gorm:"type:varchar(50);not null" json:"concert_id"`
}

func (s *SummaryReport) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ReportID == "" {
		s.ReportID = GenerateID("SR")
	}
	return
}
