package models

import (
	"time"

	"gorm.io/gorm"
)

// Concert - ข้อมูลงานคอนเสิร์ต
type Concert struct {
	ConcertID     string `gorm:"primaryKey;type:varchar(50);not null" json:"concert_id"`
	ConcertName   string `gorm:"type:varchar(255);not null" json:"concert_name"`
	StartDate     string `gorm:"type:date;not null" json:"start_date"`
	EndDate       string `gorm:"type:date;not null" json:"end_date"`
	StartTime     string `gorm:"type:time without time zone;not null" json:"start_time"`
	EndTime       string `gorm:"type:time without time zone;not null" json:"end_time"`
	Location      string `gorm:"type:varchar(255);not null" json:"location"`
	Status        string `gorm:"type:varchar(50);not null" json:"status"`
	ConcertPoster []byte `gorm:"type:bytea" json:"concert_poster,omitempty"`
	Poster        []byte `gorm:"type:bytea" json:"poster,omitempty"`
	MoreInfo      string `gorm:"type:text;not null" json:"more_info"`

	BaseModel

	ConcertArtists		[]ConcertArtist `gorm:"foreignKey:ConcertID"`
	ConcertDocuments 	[]ConcertDocument `gorm:"foreignKey:ConcertID"`
	ModifiedHistories 	[]ModifiedHistory `gorm:"foreignKey:ConcertID"`
	SummaryReports		[]SummaryReport `gorm:"foreignKey:ConcertID"`
	ArtistRequirements	[]ArtistRequirement `gorm:"foreignKey:ConcertID"`		
	PerformanceSchedule *PerformanceSchedule `gorm:"foreignKey:ConcertID"`
	Promotions 			[]Promotion `gorm:"foreignKey:ConcertID"`
	WorkPlan			*WorkPlan `gorm:"foreignKey:ConcertID"`
	SponsorshipRequest 	[]SponsorshipRequest `gorm:"foreignKey:ConcertID"`
	Tasks 				[]Task `gorm:"foreignKey:ConcertID"`
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
	Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
	
	ArtistID         string `gorm:"primaryKey;type:varchar(50);not null" json:"artist_id"`
	Artist Artist `gorm:"foreignKey:ArtistID;references:ArtistID"`

	InvitationStatus string `gorm:"type:varchar(50);not null;default:'รอการตอบรับ'" json:"invitation_status"`
}

// ConcertDocument - เอกสารของงานคอนเสิร์ต
type ConcertDocument struct {
	DocumentID   string `gorm:"primaryKey;type:varchar(50);not null" json:"document_id"`
	Category     string `gorm:"type:varchar(100);not null" json:"category"`
	DocumentName string `gorm:"type:text;not null" json:"document_name"`
	DocumentFile []byte `gorm:"type:bytea" json:"document_file,omitempty"`

	ConcertID    string `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
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
	CreatedAt   time.Time `gorm:"type:timestamp without time zone;autoCreateTime;not null" json:"created_at"`

	ConcertID   string    `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
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
	Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
}

func (s *SummaryReport) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ReportID == "" {
		s.ReportID = GenerateID("SR")
	}
	return
}
