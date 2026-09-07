package models

import (
	"time"

	"gorm.io/gorm"
)

// Zone - โซนในงานคอนเสิร์ต
type Zone struct {
	ZoneID   string `gorm:"primaryKey;type:varchar(50);not null" json:"zone_id"`
	ZoneType string `gorm:"type:varchar(100);not null" json:"zone_type"`
	Capacity int    `gorm:"type:int;not null" json:"capacity"`

	// Relations
	Seats            []Seat           `gorm:"foreignKey:ZoneID" json:"seats,omitempty"`
	TicketCategories []TicketCategory `gorm:"foreignKey:ZoneID" json:"ticket_categories,omitempty"`
}

func (z *Zone) BeforeCreate(tx *gorm.DB) (err error) {
	if z.ZoneID == "" {
		z.ZoneID = GenerateID("ZN")
	}
	return
}

// Seat - ที่นั่ง
type Seat struct {
	SeatID     string `gorm:"primaryKey;type:varchar(50);not null" json:"seat_id"`
	SeatColumn int    `gorm:"type:int;not null" json:"seat_column"`
	SeatRow    int    `gorm:"type:int;not null" json:"seat_row"`
	StatusSeat string `gorm:"type:varchar(50);not null" json:"status_seat"`
	ConcertID  string `gorm:"type:varchar(50);not null" json:"concert_id"`
	ZoneID     string `gorm:"type:varchar(50);not null" json:"zone_id"`

	// Relations
	Tickets []Ticket `gorm:"foreignKey:SeatID" json:"tickets,omitempty"`
}

func (s *Seat) BeforeCreate(tx *gorm.DB) (err error) {
	if s.SeatID == "" {
		s.SeatID = GenerateID("ST")
	}
	return
}

// TicketCategory - หมวดหมู่ตั๋ว
type TicketCategory struct {
	CategoryID    string  `gorm:"primaryKey;type:varchar(50);not null" json:"category_id"`
	CategoryName  string  `gorm:"type:varchar(255);not null" json:"category_name"`
	Price         float64 `gorm:"type:float;not null" json:"price"`
	Quantity      int     `gorm:"type:int;not null" json:"quantity"`
	PromotionName string  `gorm:"type:varchar(255);not null" json:"promotion_name"`
	PromotionID   string  `gorm:"type:varchar(50);not null" json:"promotion_id"`
	ZoneID        string  `gorm:"type:varchar(50);not null" json:"zone_id"`
}

func (t *TicketCategory) BeforeCreate(tx *gorm.DB) (err error) {
	if t.CategoryID == "" {
		t.CategoryID = GenerateID("TC")
	}
	return
}

// TicketSalesInfo - ข้อมูลการขายตั๋ว
type TicketSalesInfo struct {
	InfoSID         string    `gorm:"primaryKey;type:varchar(50);not null" json:"info_sid"`
	SaleRound       string    `gorm:"type:varchar(100);not null" json:"sale_round"`
	PriceTicket     float64   `gorm:"type:float;not null" json:"price_ticket"`
	ReturnCondition string    `gorm:"type:text;not null" json:"return_condition"`
	PublishDate     time.Time `gorm:"type:date;not null" json:"publish_date"`
}

func (t *TicketSalesInfo) BeforeCreate(tx *gorm.DB) (err error) {
	if t.InfoSID == "" {
		t.InfoSID = GenerateID("SI")
	}
	return
}

// Ticket - ตั๋ว
type Ticket struct {
	TicketID       string    `gorm:"primaryKey;type:varchar(50);not null" json:"ticket_id"`
	NameConcert    string    `gorm:"type:varchar(255);not null" json:"name_concert"`
	TicketDateTime time.Time `gorm:"type:timestamp;not null" json:"ticket_datetime"`
	StatusTicket   string    `gorm:"type:varchar(50);not null" json:"status_ticket"`
	SeatID         string    `gorm:"type:varchar(50);not null" json:"seat_id"`
	BookingID      string    `gorm:"type:varchar(50);not null" json:"booking_id"`
}

func (t *Ticket) BeforeCreate(tx *gorm.DB) (err error) {
	if t.TicketID == "" {
		t.TicketID = GenerateID("TK")
	}
	return
}

// Booking - การจองตั๋ว
type Booking struct {
	BookingID   string    `gorm:"primaryKey;type:varchar(50);not null" json:"booking_id"`
	BookingDate time.Time `gorm:"type:date;not null" json:"booking_date"`
	Status      string    `gorm:"type:varchar(50);not null" json:"status"`

	// Relations
	Tickets  []Ticket  `gorm:"foreignKey:BookingID" json:"tickets,omitempty"`
	Payments []Payment `gorm:"foreignKey:BookingID" json:"payments,omitempty"`
}

func (b *Booking) BeforeCreate(tx *gorm.DB) (err error) {
	if b.BookingID == "" {
		b.BookingID = GenerateID("BK")
	}
	return
}

// Payment - การชำระเงิน
type Payment struct {
	PaymentID     string `gorm:"primaryKey;type:varchar(50);not null" json:"payment_id"`
	EvidenceFile  []byte `gorm:"type:bytea;not null" json:"evidence_file,omitempty"`
	PaymentStatus string `gorm:"type:varchar(50);not null" json:"payment_status"`
	BookingID     string `gorm:"type:varchar(50);not null" json:"booking_id"`
}

func (p *Payment) BeforeCreate(tx *gorm.DB) (err error) {
	if p.PaymentID == "" {
		p.PaymentID = GenerateID("PY")
	}
	return
}

// GateCheckIn - ประตูเช็คอิน
type GateCheckIn struct {
	GateID       string    `gorm:"primaryKey;type:varchar(50);not null" json:"gate_id"`
	GateDateTime time.Time `gorm:"type:timestamp;not null" json:"gate_datetime"`
}

func (g *GateCheckIn) BeforeCreate(tx *gorm.DB) (err error) {
	if g.GateID == "" {
		g.GateID = GenerateID("GC")
	}
	return
}

// SalesReport - รายงานยอดขาย
type SalesReport struct {
	ReportID     string    `gorm:"primaryKey;type:varchar(50);not null" json:"report_id"`
	TicketSold   int       `gorm:"type:int;not null" json:"ticket_sold"`
	TotalSelling float64   `gorm:"type:double precision;not null" json:"total_selling"`
	ReportDate   time.Time `gorm:"type:date;not null" json:"report_date"`
	UserID       string    `gorm:"type:varchar(50);not null" json:"user_id"`
}

func (s *SalesReport) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ReportID == "" {
		s.ReportID = GenerateID("SL")
	}
	return
}
