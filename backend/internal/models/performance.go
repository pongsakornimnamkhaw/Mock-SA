package models

import (
	"gorm.io/gorm"
)

// PerformanceSchedule - ตารางการแสดง
type PerformanceSchedule struct {
	ScheduleID       string `gorm:"primaryKey;type:varchar(50);not null" json:"schedule_id"`
	PerformanceOrder int    `gorm:"type:int;not null" json:"performance_order"`
	Details          string `gorm:"type:text;not null" json:"details"`
	StartShow        string `gorm:"type:time without time zone;not null" json:"start_show"`
	EndShow          string `gorm:"type:time without time zone;not null" json:"end_show"`

	ConcertID        string `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`

	ArtistID         string `gorm:"type:varchar(50);default:''" json:"artist_id"`
	Artists []Artist `gorm:"many2many:ArtistPerformance"`

	ShowDate         string `gorm:"type:date" json:"show_date"`

	// Relations
	PerformanceDetails []PerformanceDetail `gorm:"foreignKey:ScheduleID" json:"performance_details,omitempty"`
}

func (p *PerformanceSchedule) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ScheduleID == "" {
		p.ScheduleID = GenerateID("PS")
	}
	return
}

// PerformanceDetail - รายละเอียดการแสดง
type PerformanceDetail struct {
	DetailID           string `gorm:"primaryKey;type:varchar(50);not null" json:"detail_id"`
	PerformanceDetails string `gorm:"type:text;not null" json:"performance_details"`
	
	ScheduleID         string `gorm:"type:varchar(50);not null" json:"schedule_id"`
	PerformanceSchedule PerformanceSchedule `gorm:"foreignKey:ScheduleID;references:ScheduleID"`

	StageInfo          string `gorm:"type:text;not null" json:"stage_info"`
	SoundCheckInfo     string `gorm:"type:text;not null" json:"sound_check_info"`
	
	ArtistID           string `gorm:"type:varchar(50);default:''" json:"artist_id"`
}

func (d *PerformanceDetail) BeforeCreate(tx *gorm.DB) (err error) {
	if d.DetailID == "" {
		d.DetailID = GenerateID("PD")
	}
	return
}
