package models

import (
	"time"

	"gorm.io/gorm"
)

type EmployeePasswordSetupToken struct {
	TokenID   string     `gorm:"primaryKey;type:varchar(50);not null" json:"token_id"`
	UserID    string     `gorm:"type:varchar(50);not null;uniqueIndex:ux_employee_password_setup_tokens_user_id" json:"user_id"`
	TokenHash string     `gorm:"type:varchar(64);not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	CreatedAt time.Time  `gorm:"not null" json:"created_at"`
	User      User       `gorm:"foreignKey:UserID;references:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"-"`
}

func (t *EmployeePasswordSetupToken) BeforeCreate(tx *gorm.DB) error {
	if t.TokenID == "" {
		t.TokenID = GenerateID("EPS")
	}
	return nil
}
