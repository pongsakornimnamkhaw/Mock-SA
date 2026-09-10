package models

import (
	"time"

	"gorm.io/gorm"
)

// WorkPlan - แผนการทำงาน
type WorkPlan struct {
	PlanID         string    `gorm:"primaryKey;type:varchar(50);not null" json:"plan_id"`
	ScheduleDetail string    `gorm:"type:varchar(500);not null" json:"schedule_detail"`
	Budget         float64   `gorm:"type:float;not null" json:"budget"`
	ApprovalStatus string    `gorm:"type:varchar(50);not null" json:"approval_status"`
	UpdateDate     time.Time `gorm:"type:date;not null" json:"update_date"`

	ConcertID string  `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert   Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
}

func (w *WorkPlan) BeforeCreate(tx *gorm.DB) (err error) {
	if w.PlanID == "" {
		w.PlanID = GenerateID("WP")
	}
	return
}

// SponsorshipRequest - คำขอสนับสนุน
type SponsorshipRequest struct {
	RequestID       string    `gorm:"primaryKey;type:varchar(50);not null" json:"request_id"`
	AdPackage       string    `gorm:"type:text;not null" json:"ad_package"`
	LogoURL         string    `gorm:"type:varchar(500);not null" json:"logo_url"`
	AgreementDocURL string    `gorm:"type:varchar(500);not null" json:"agreement_doc_url"`
	SubmitDate      time.Time `gorm:"type:date;not null" json:"submit_date"`
	Status          string    `gorm:"type:varchar(50);not null" json:"status"`

	ConcertID string `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert   Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
}

func (s *SponsorshipRequest) BeforeCreate(tx *gorm.DB) (err error) {
	if s.RequestID == "" {
		s.RequestID = GenerateID("SP")
	}
	return
}

// Task - งานที่ต้องทำ
type Task struct {
	TaskID           string `gorm:"primaryKey;type:varchar(50);not null" json:"task_id"`
	TaskName         string `gorm:"type:text;not null" json:"task_name"`
	ActualFinishDate string `gorm:"type:date;not null" json:"actual_finish_date"`
	OwnerTask        string `gorm:"type:varchar(100);not null" json:"owner_task"`
	Department       string `gorm:"type:varchar(100);not null" json:"department"`
	TaskStatus       string `gorm:"type:varchar(50);not null" json:"task_status"`
	MoreInfo         string `gorm:"type:varchar(500);not null" json:"more_info"`

	ConcertID string  `gorm:"type:varchar(50);not null" json:"concert_id"`
	Concert   Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`
}

func (t *Task) BeforeCreate(tx *gorm.DB) (err error) {
	if t.TaskID == "" {
		t.TaskID = GenerateID("TS")
	}
	return
}
