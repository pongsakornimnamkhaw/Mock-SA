package models

import (
	"fmt"
	"math/rand"
	"time"
)

// BaseModel เป็น base struct สำหรับทุก model
type BaseModel struct {
	CreatedAt time.Time `gorm:"autoCreateTime;not null" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null" json:"updated_at"`
}

// GenerateID สร้าง ID รูปแบบ: 2 ตัวอักษร + ตัวเลข 6 หลัก
// เช่น US000001, CO123456, AR987654
func GenerateID(prefix string) string {
	n := rand.Intn(900000) + 100000 // 100000 - 999999
	return fmt.Sprintf("%s%06d", prefix, n)
}
