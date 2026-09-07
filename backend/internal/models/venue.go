package models

import (
	"time"

	"gorm.io/gorm"
)

// VenueSeatPlan - แผนงานคอนเสิร์ต (concert plan metadata)
type VenueSeatPlan struct {
	LayoutID      string `gorm:"primaryKey;type:varchar(100);not null" json:"layout_id"`
	ConcertID     string `gorm:"type:varchar(50);uniqueIndex;not null" json:"concert_id"`
	Category      string `gorm:"type:varchar(100);not null" json:"category"`
	ArtistDisplay string `gorm:"type:varchar(500);not null" json:"artist_display"`

	BaseModel
}

func (v *VenueSeatPlan) BeforeCreate(tx *gorm.DB) (err error) {
	if v.LayoutID == "" {
		v.LayoutID = GenerateID("VP")
	}
	return
}

// VenueSeatRound - รอบการแสดง
type VenueSeatRound struct {
	RoundID   string    `gorm:"primaryKey;type:varchar(50);not null" json:"round_id"`
	ConcertID string    `gorm:"type:varchar(50);index;not null" json:"concert_id"`
	Name      string    `gorm:"type:varchar(255);not null" json:"name"`
	ShowDate  time.Time `gorm:"type:date;not null" json:"show_date"`
	DoorTime  string    `gorm:"type:time without time zone;not null" json:"door_time"`
	Status    string    `gorm:"type:varchar(50);not null" json:"status"`
}

func (v *VenueSeatRound) BeforeCreate(tx *gorm.DB) (err error) {
	if v.RoundID == "" {
		v.RoundID = GenerateID("VR")
	}
	return
}

// VenueSeatZone - โซนที่นั่ง
type VenueSeatZone struct {
	ZoneID    string  `gorm:"primaryKey;type:varchar(50);not null" json:"zone_id"`
	ConcertID string  `gorm:"type:varchar(50);index;not null" json:"concert_id"`
	Name      string  `gorm:"type:varchar(255);not null" json:"name"`
	Color     string  `gorm:"type:varchar(20);not null" json:"color"`
	Price     float64 `gorm:"type:double precision;not null" json:"price"`
	SeatCount int     `gorm:"type:int;not null" json:"seat_count"`
	ZoneType  string  `gorm:"type:varchar(100);not null" json:"zone_type"`
	Shape     string  `gorm:"type:varchar(50);not null" json:"shape"`
	X         float64 `gorm:"type:double precision;not null" json:"x"`
	Y         float64 `gorm:"type:double precision;not null" json:"y"`
	Width     float64 `gorm:"type:double precision;not null" json:"width"`
	Height    float64 `gorm:"type:double precision;not null" json:"height"`
	Rotation  float64 `gorm:"type:double precision;not null" json:"rotation"`
	Layer     int64   `gorm:"column:layer_order;type:bigint;not null" json:"layer"`
}

func (v *VenueSeatZone) BeforeCreate(tx *gorm.DB) (err error) {
	if v.ZoneID == "" {
		v.ZoneID = GenerateID("VZ")
	}
	return
}

// VenueSeat - ที่นั่งแต่ละตัว
type VenueSeat struct {
	SeatID   string  `gorm:"primaryKey;type:varchar(50);not null" json:"seat_id"`
	ZoneID   string  `gorm:"type:varchar(50);index;not null" json:"zone_id"`
	Name     string  `gorm:"type:varchar(50);not null" json:"name"`
	X        float64 `gorm:"type:double precision;not null" json:"x"`
	Y        float64 `gorm:"type:double precision;not null" json:"y"`
	Disabled bool    `gorm:"default:false;not null" json:"disabled"`
}

func (v *VenueSeat) BeforeCreate(tx *gorm.DB) (err error) {
	if v.SeatID == "" {
		v.SeatID = GenerateID("VS")
	}
	return
}

// VenueLayoutObject - object บน layout (เช่น เวที, ประตู, ป้าย)
type VenueLayoutObject struct {
	ObjectID  string  `gorm:"primaryKey;type:varchar(50);not null" json:"object_id"`
	ConcertID string  `gorm:"type:varchar(50);index;not null" json:"concert_id"`
	Kind      string  `gorm:"type:varchar(50);not null" json:"kind"`
	Shape     string  `gorm:"type:varchar(50);not null" json:"shape"`
	Name      string  `gorm:"type:varchar(255);not null" json:"name"`
	Color     string  `gorm:"type:varchar(20);not null" json:"color"`
	TextColor string  `gorm:"type:varchar(20);not null" json:"text_color"`
	X         float64 `gorm:"type:double precision;not null" json:"x"`
	Y         float64 `gorm:"type:double precision;not null" json:"y"`
	Width     float64 `gorm:"type:double precision;not null" json:"width"`
	Height    float64 `gorm:"type:double precision;not null" json:"height"`
	Rotation  float64 `gorm:"type:double precision;not null" json:"rotation"`
	Layer     int64   `gorm:"column:layer_order;type:bigint;not null" json:"layer"`
}

func (v *VenueLayoutObject) BeforeCreate(tx *gorm.DB) (err error) {
	if v.ObjectID == "" {
		v.ObjectID = GenerateID("VO")
	}
	return
}

// VenueSeatPublication - การเผยแพร่/ขายตั๋ว
type VenueSeatPublication struct {
	PublicationID string     `gorm:"primaryKey;type:varchar(50);not null" json:"publication_id"`
	ConcertID     string     `gorm:"type:varchar(50);uniqueIndex;not null" json:"concert_id"`
	ScheduleFile  string     `gorm:"type:varchar(500);not null" json:"schedule_file"`
	ScheduleImage []byte     `gorm:"type:bytea;not null" json:"schedule_image,omitempty"`
	SaleStart     *time.Time `gorm:"type:timestamp" json:"sale_start"`
	SaleEnd       *time.Time `gorm:"type:timestamp" json:"sale_end"`
	PublishAt     *time.Time `gorm:"type:timestamp" json:"publish_at"`
	UnpublishAt   *time.Time `gorm:"type:timestamp" json:"unpublish_at"`

	BaseModel
}

func (v *VenueSeatPublication) BeforeCreate(tx *gorm.DB) (err error) {
	if v.PublicationID == "" {
		v.PublicationID = GenerateID("PU")
	}
	return
}
