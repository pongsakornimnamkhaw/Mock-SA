package models

import (
	"time"

	"gorm.io/gorm"
)

// Zone - โซนในงานคอนเสิร์ต (ตำแหน่ง/รูปทรงมาจากผังที่นั่งที่พนักงานวาด)
type Zone struct {
	ZoneID     string  `gorm:"primaryKey;type:varchar(50);not null" json:"zone_id"`
	ZoneType   string  `gorm:"type:varchar(100);not null" json:"zone_type"`
	Capacity   int     `gorm:"type:int;not null" json:"capacity"`
	PositionX  float64 `gorm:"column:position_x;type:double precision;not null;default:0" json:"position_x"`
	PositionY  float64 `gorm:"column:position_y;type:double precision;not null;default:0" json:"position_y"`
	Width      float64 `gorm:"type:double precision;not null;default:0" json:"width"`
	Height     float64 `gorm:"type:double precision;not null;default:0" json:"height"`
	Rotation   float64 `gorm:"type:double precision;not null;default:0" json:"rotation"`
	Shape      string  `gorm:"type:varchar(50);not null;default:''" json:"shape"`
	Color      string  `gorm:"type:varchar(20);not null;default:''" json:"color"`
	LayerOrder int64   `gorm:"column:layer_order;type:bigint;not null;default:0" json:"layer_order"`

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

// Seat - ที่นั่ง (status_seat เป็นตัวชี้ขาดว่าที่นั่งใบนี้ขายไปแล้วหรือยัง)
type Seat struct {
	SeatID     string  `gorm:"primaryKey;type:varchar(50);not null" json:"seat_id"`
	SeatColumn string  `gorm:"type:varchar(50);not null" json:"seat_column"`
	SeatRow    string  `gorm:"type:varchar(50);not null" json:"seat_row"`
	StatusSeat string  `gorm:"type:varchar(50);not null" json:"status_seat"`
	Flowchart  []byte  `gorm:"type:bytea" json:"flowchart,omitempty"`
	PositionX  float64 `gorm:"column:position_x;type:double precision;not null;default:0" json:"position_x"`
	PositionY  float64 `gorm:"column:position_y;type:double precision;not null;default:0" json:"position_y"`
	Rotation   float64 `gorm:"type:double precision;not null;default:0" json:"rotation"`

	ConcertID string  `gorm:"type:varchar(50);not null;index" json:"concert_id"`
	Concert   Concert `gorm:"foreignKey:ConcertID;references:ConcertID"`

	ZoneID string `gorm:"type:varchar(50);not null;index" json:"zone_id"`
	Zone   Zone   `gorm:"foreignKey:ZoneID;references:ZoneID"`
	// Relations
	Tickets []Ticket `gorm:"foreignKey:SeatID" json:"tickets,omitempty"`
}

func (s *Seat) BeforeCreate(tx *gorm.DB) (err error) {
	if s.SeatID == "" {
		s.SeatID = GenerateID("ST")
	}
	return
}

// Label คืนป้ายที่นั่งที่หน้าเว็บใช้ เช่น "A12" (แถว A คอลัมน์ 12)
func (s *Seat) Label() string {
	return s.SeatRow + s.SeatColumn
}

// TicketCategory - หมวดหมู่ตั๋ว
// PromotionName/PromotionID เป็น nullable โดยตั้งใจ: หมวดหมู่ที่ project มาจากผังที่นั่ง
// (ดู seat_inventory.go) ไม่ได้ผูกกับโปรโมชั่นใด ๆ — โปรโมชั่นคิดที่ระดับ booking แทน
// ต้องเป็น *string ไม่ใช่ string เพราะมี FK ไปยัง promotions.promotion_id ค่าว่าง ""
// จะชน FK (ไม่มีแถวโปรโมชั่นที่ id เป็นค่าว่าง) มีแต่ NULL เท่านั้นที่ผ่าน FK ได้เมื่อไม่มีโปรโมชั่น
type TicketCategory struct {
	CategoryID    string  `gorm:"primaryKey;type:varchar(50);not null" json:"category_id"`
	CategoryName  string  `gorm:"type:varchar(255);not null" json:"category_name"`
	Price         float64 `gorm:"type:float;not null" json:"price"`
	Quantity      int     `gorm:"type:int;not null" json:"quantity"`
	PromotionName *string `gorm:"type:varchar(255)" json:"promotion_name,omitempty"`

	PromotionID *string   `gorm:"type:varchar(50)" json:"promotion_id,omitempty"`
	Promotion   Promotion `gorm:"foreignKey:PromotionID;references:PromotionID"`

	ZoneID string `gorm:"type:varchar(50);not null" json:"zone_id"`
	Zone   Zone   `gorm:"foreignKey:ZoneID;references:ZoneID"`
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

	// SeatID string  `gorm:"primaryKey;type:varchar(50);not null" json:"seat_id"`
}

func (t *TicketSalesInfo) BeforeCreate(tx *gorm.DB) (err error) {
	if t.InfoSID == "" {
		t.InfoSID = GenerateID("SI")
	}
	return
}

// Ticket - ตั๋ว (ผูกกับที่นั่งจริงและหมวดหมู่ราคาที่ซื้อ ณ ตอนจอง)
type Ticket struct {
	TicketID       string    `gorm:"primaryKey;type:varchar(50);not null" json:"ticket_id"`
	NameConcert    string    `gorm:"type:varchar(255);not null" json:"name_concert"`
	TicketDateTime time.Time `gorm:"type:timestamp;not null" json:"ticket_datetime"`
	ImageTicket    []byte    `gorm:"type:bytea" json:"image_ticket,omitempty"`
	PriceTicket    float64   `gorm:"type:double precision;not null;default:0" json:"price_ticket"`
	StatusTicket   string    `gorm:"type:varchar(50);not null" json:"status_ticket"`
	SeatID         string    `gorm:"type:varchar(50);not null;index" json:"seat_id"`
	SeatLabel      string    `gorm:"type:varchar(50)" json:"seat_label,omitempty"`
	CategoryID     string    `gorm:"type:varchar(50);index" json:"category_id,omitempty"`
	BookingID      string    `gorm:"type:varchar(50);not null;index" json:"booking_id"`
	QrCodeData     string    `gorm:"type:text" json:"qr_code_data,omitempty"`
}

func (t *Ticket) BeforeCreate(tx *gorm.DB) (err error) {
	if t.TicketID == "" {
		t.TicketID = GenerateID("TK")
	}
	return
}

// Booking - การจองตั๋ว
type Booking struct {
	BookingID      string     `gorm:"primaryKey;type:varchar(50);not null" json:"booking_id"`
	BookingDate    time.Time  `gorm:"type:date;not null" json:"booking_date"`
	Status         string     `gorm:"type:varchar(50);not null" json:"status"`
	UserID         *string    `gorm:"type:varchar(50);index" json:"user_id,omitempty"`
	CustomerName   string     `gorm:"type:varchar(255)" json:"customer_name,omitempty"`
	CustomerEmail  string     `gorm:"type:varchar(255)" json:"customer_email,omitempty"`
	CustomerPhone  string     `gorm:"type:varchar(50)" json:"customer_phone,omitempty"`
	ConcertID      string     `gorm:"type:varchar(50)" json:"concert_id,omitempty"`
	ConcertTitle   string     `gorm:"type:varchar(255)" json:"concert_title,omitempty"`
	ZoneID         string     `gorm:"type:varchar(50)" json:"zone_id,omitempty"`
	TierName       string     `gorm:"type:varchar(100)" json:"tier_name,omitempty"`
	Quantity       int        `gorm:"type:int;default:1" json:"quantity"`
	UnitPrice      float64    `gorm:"type:double precision;default:0" json:"unit_price"`
	DiscountAmount float64    `gorm:"type:double precision;default:0" json:"discount_amount"`
	TotalPrice     float64    `gorm:"type:double precision;default:0" json:"total_price"`
	RejectReason   string     `gorm:"type:text" json:"reject_reason,omitempty"`
	ReviewedBy     string     `gorm:"type:varchar(100)" json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time `gorm:"type:timestamp without time zone" json:"reviewed_at,omitempty"`

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
	PaymentID     string    `gorm:"primaryKey;type:varchar(50);not null" json:"payment_id"`
	EvidenceFile  []byte    `gorm:"type:bytea" json:"evidence_file,omitempty"`
	FileName      string    `gorm:"type:varchar(255)" json:"file_name,omitempty"`
	PaymentStatus string    `gorm:"type:varchar(50);not null" json:"payment_status"`
	BookingID     string    `gorm:"type:varchar(50);not null" json:"booking_id"`
	CreatedAt     time.Time `gorm:"type:timestamp without time zone;autoCreateTime" json:"created_at"`
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

	UserID string `gorm:"type:varchar(50);not null" json:"user_id"`
	User   User   `gorm:"foreignKey:UserID;references:UserID"`
}

func (s *SalesReport) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ReportID == "" {
		s.ReportID = GenerateID("SL")
	}
	return
}
