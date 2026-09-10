package models

import (
	"time"

	"gorm.io/gorm"
)

// User - ผู้ใช้งานในระบบ
type User struct {
	UserID           string    `gorm:"primaryKey;type:varchar(50);not null" json:"user_id"`
	FirstName        string    `gorm:"type:varchar(100);not null" json:"first_name"`
	LastName         string    `gorm:"type:varchar(100);not null" json:"last_name"`
	DateOfBirth      time.Time `gorm:"type:date;not null" json:"date_of_birth"`
	Gender           string    `gorm:"type:varchar(20);not null" json:"gender"`
	PhoneNumber      string    `gorm:"type:varchar(20);not null" json:"phone_number"`
	Address          string    `gorm:"type:text" json:"address"`
	Email            string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash     string    `gorm:"type:text;not null;default:''" json:"-"`
	UserType         string    `gorm:"type:varchar(50);not null" json:"user_type"`
	Role             string    `gorm:"type:varchar(50);not null" json:"role"`
	CompanyName      string    `gorm:"type:varchar(255)" json:"company_name"`
	EmployeeCode     *string   `gorm:"type:varchar(50);uniqueIndex" json:"employee_code,omitempty"`
	Department       string    `gorm:"type:varchar(100)" json:"department"`
	EmployeeInactive bool      `gorm:"not null;default:false" json:"employee_inactive"`
	PersonnelType    string    `gorm:"type:varchar(20)" json:"personnel_type"`

	// Relations
	Permissions        []Permission        `gorm:"foreignKey:UserID" json:"permissions,omitempty"`
	CusActivityLogs    []CusActivityLogs   `gorm:"foreignKey:UserID" json:"cus_activity_logs,omitempty"`
	EmpActivityLogs    []EmpActivityLogs   `gorm:"foreignKey:UserID" json:"emp_activity_logs,omitempty"`
	Inquiries          []Inquiry           `gorm:"foreignKey:UserID" json:"inquiries,omitempty"`
	SalesReports       []SalesReport       `gorm:"foreignKey:UserID" json:"sales_reports,omitempty"`
	PromotionApprovals []PromotionApproval `gorm:"foreignKey:UserID" json:"promotion_approvals,omitempty"`

	BaseModel
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.UserID == "" {
		u.UserID = GenerateID("US")
	}
	return
}

// CusActivityLogs - บันทึกกิจกรรมของลูกค้า
type CusActivityLogs struct {
	CusLogID    string    `gorm:"primaryKey;type:varchar(50);not null" json:"cus_log_id"`
	ActionType  string    `gorm:"type:varchar(100);not null" json:"action_type"`
	Description string    `gorm:"type:text;not null" json:"description"`
	TargetID    string    `gorm:"type:varchar(50)" json:"target_id"`
	CreatedAt   time.Time `gorm:"type:timestamp without time zone;autoCreateTime;not null" json:"created_at"`
	
	UserID      string    `gorm:"type:varchar(50);not null" json:"user_id"`
	User User `gorm:"foreignKey:UserID;references:UserID"`
}

func (c *CusActivityLogs) BeforeCreate(tx *gorm.DB) (err error) {
	if c.CusLogID == "" {
		c.CusLogID = GenerateID("CL")
	}
	return
}

// EmpActivityLogs - บันทึกกิจกรรมของพนักงาน
type EmpActivityLogs struct {
	EmpLogID    string    `gorm:"primaryKey;type:varchar(50);not null" json:"emp_log_id"`
	ActionType  string    `gorm:"type:varchar(100);not null" json:"action_type"`
	Description string    `gorm:"type:text;not null" json:"description"`
	TargetID    string    `gorm:"type:varchar(50)" json:"target_id"`
	Module      string    `gorm:"type:varchar(100)" json:"module"`
	CreatedAt   time.Time `gorm:"type:timestamp without time zone;autoCreateTime;not null" json:"created_at"`
	
	UserID      *string   `gorm:"type:varchar(50)" json:"user_id"`
	User User `gorm:"foreignKey:UserID;references:UserID"`
}

func (e *EmpActivityLogs) BeforeCreate(tx *gorm.DB) (err error) {
	if e.EmpLogID == "" {
		e.EmpLogID = GenerateID("EL")
	}
	return
}

// Permission - สิทธิ์การเข้าถึงของผู้ใช้
type Permission struct {
	PermissionID   string `gorm:"primaryKey;type:varchar(50);not null" json:"permission_id"`
	Position       string `gorm:"type:varchar(100);not null" json:"position"`
	PermissionName string `gorm:"type:varchar(100);not null" json:"permission_name"`
	Scope          string `gorm:"type:varchar(100);not null" json:"scope"`
	
	UserID         string `gorm:"type:varchar(50);not null" json:"user_id"`
	User User `gorm:"foreignKey:UserID;references:UserID"`
}

func (p *Permission) BeforeCreate(tx *gorm.DB) (err error) {
	if p.PermissionID == "" {
		p.PermissionID = GenerateID("PM")
	}
	return
}

// Inquiry - คำถาม/สอบถาม
type Inquiry struct {
	InquiryID    string `gorm:"primaryKey;type:varchar(50);not null" json:"inquiry_id"`
	QuestionText string `gorm:"type:text;not null" json:"question_text"`
	AnswerText   string `gorm:"type:text;not null" json:"answer_text"`
	Status       string `gorm:"type:varchar(50);not null" json:"status"`

	UserID       string `gorm:"type:varchar(50);not null" json:"user_id"`
	User User `gorm:"foreignKey:UserID;references:UserID"`
}

func (i *Inquiry) BeforeCreate(tx *gorm.DB) (err error) {
	if i.InquiryID == "" {
		i.InquiryID = GenerateID("IQ")
	}
	return
}
