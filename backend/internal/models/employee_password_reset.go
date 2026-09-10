package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	PersonnelTypeInternal = "internal"
	PersonnelTypeExternal = "external"
	EmployeeResetPending  = "pending"
	EmployeeResetApproved = "approved"
	EmployeeResetRejected = "rejected"
	EmployeeResetUsed     = "used"
	EmployeeResetExpired  = "expired"
)

type EmployeePasswordResetRequest struct {
	RequestID        string     `gorm:"primaryKey;type:varchar(50)"`
	ReferenceCode    string     `gorm:"type:varchar(30);uniqueIndex;not null"`
	UserID           string     `gorm:"type:varchar(50);index;not null"`
	BrowserTokenHash string     `gorm:"type:varchar(64);uniqueIndex;not null"`
	Status           string     `gorm:"type:varchar(20);index;not null"`
	ApprovedBy       *string    `gorm:"type:varchar(50)"`
	RejectionReason  string     `gorm:"type:text"`
	PhoneVerifiedAt  *time.Time `gorm:"type:timestamp without time zone"`
	ApprovedAt       *time.Time `gorm:"type:timestamp without time zone"`
	ExpiresAt        *time.Time `gorm:"type:timestamp without time zone;index"`
	UsedAt           *time.Time `gorm:"type:timestamp without time zone"`
	CreatedAt        time.Time  `gorm:"type:timestamp without time zone;autoCreateTime;index"`
}

func (r *EmployeePasswordResetRequest) BeforeCreate(tx *gorm.DB) (err error) {
	if r.RequestID == "" {
		r.RequestID = GenerateID("ER")
	}
	return
}
