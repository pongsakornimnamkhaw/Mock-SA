// seed-management adds an explicitly labelled, local-development dataset only.
// It never migrates tables or updates/deletes existing application records.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"backend/internal/config"
	"backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

const prefix = "DEMO_MGMT_V1_"
const markerID = prefix + "SEED_COMPLETE"

type employeeSpec struct {
	name, department, permission, scope string
}

var employees = []employeeSpec{
	{"แอดมินทดสอบเอ", "ฝ่ายบุคคล", "admin", "all"},
	{"แอดมินทดสอบบี", "ฝ่ายการตลาด", "admin", "all"},
	{"พนักงานทดสอบซี", "ฝ่ายการตลาด", "edit", "promotions"},
	{"พนักงานทดสอบดี", "ฝ่ายบุคคล", "edit", "users"},
	{"พนักงานทดสอบอี", "ฝ่ายโปรดักชั่น", "edit", "all"},
	{"พนักงานทดสอบเอฟ", "ฝ่ายการเงิน", "view_only", ""},
	{"พนักงานทดสอบจี", "ฝ่ายสถานที่", "view_only", ""},
	{"พนักงานทดสอบเอช", "ฝ่ายประชาสัมพันธ์", "view_only", ""},
}

type promotionSpec struct {
	name, code, discountType, status, approval string
	value, cap                                 float64
	used                                       int
}

var promotions = []promotionSpec{
	{"Early Bird ลด 10%", "TEST-MGMT-EARLY10", "percent", "active", "approved", 10, 300, 12},
	{"ลดทันที 200 บาท", "TEST-MGMT-SAVE200", "fixed", "active", "approved", 200, 0, 6},
	{"VIP ลด 20%", "TEST-MGMT-VIP20", "percent", "active", "approved", 20, 500, 3},
	{"แคมเปญเก่า ลด 15%", "TEST-MGMT-OLD15", "percent", "expired", "approved", 15, 400, 4},
	{"แคมเปญเก่า ลด 100 บาท", "TEST-MGMT-OLD100", "fixed", "expired", "approved", 100, 0, 2},
	{"รออนุมัติ ลด 25%", "TEST-MGMT-WAIT25", "percent", "draft", "pending", 25, 600, 0},
	{"รออนุมัติ ลด 300 บาท", "TEST-MGMT-WAIT300", "fixed", "draft", "pending", 300, 0, 0},
	{"รออนุมัติ ลด 5%", "TEST-MGMT-WAIT5", "percent", "draft", "pending", 5, 150, 0},
	{"ไม่ผ่านอนุมัติ ลด 40%", "TEST-MGMT-REJECT40", "percent", "draft", "rejected", 40, 800, 0},
	{"ไม่ผ่านอนุมัติ ลด 500 บาท", "TEST-MGMT-REJECT500", "fixed", "draft", "rejected", 500, 0, 0},
}

func main() {
	apply := flag.Bool("apply", false, "Insert demo records into the database configured in backend/.env")
	flag.Parse()
	if !*apply {
		fmt.Println("Preview: 10 promotions (3 active / 2 expired / 3 pending / 2 rejected), 8 employees, 3 demo customers, 3 zones per concert, approvals and activity/redemption history.")
		fmt.Println("Run from backend: go run ./cmd/seed-management --apply")
		fmt.Println("Development data only. Adds DEMO_MGMT_V1_ records once; does not overwrite existing data, migrate tables or create bookings/payments.")
		return
	}
	if _, err := os.Stat(".env"); err != nil {
		fmt.Fprintln(os.Stderr, "Run from backend with an existing .env; refusing to use an implicit database.")
		os.Exit(1)
	}
	config.LoadEnv()
	config.ConnectDB()
	db := config.DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)})
	sqlDB, err := db.DB()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer sqlDB.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	created, err := seed(db.WithContext(ctx), time.Now())
	if err != nil {
		fmt.Fprintln(os.Stderr, "Demo seed failed; all inserts rolled back:", err)
		os.Exit(1)
	}
	if !created {
		fmt.Println("Demo dataset already installed. Skipped all writes, preserving edits, decisions and deletions made during testing.")
		return
	}
	fmt.Println("Created: 10 promotions, 10 approval requests, 8 employees, 3 customers, 3 zones per concert, 27 simulated redemptions, 26 staff logs and 30 customer logs.")
	fmt.Println("All demo IDs start with DEMO_MGMT_V1_; promo codes start with TEST-MGMT-. Existing records are unchanged.")
}

func create(tx *gorm.DB, row any) error {
	// Explicit inserts only: never save/upsert related application objects.
	return tx.Omit(clause.Associations).Create(row).Error
}

func seed(db *gorm.DB, now time.Time) (bool, error) {
	created := false
	err := db.Transaction(func(tx *gorm.DB) error {
		// Concurrent/repeated runs install this complete dataset at most once.
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", prefix).Error; err != nil {
			return err
		}
		var count int64
		if err := tx.Model(&models.EmpActivityLogs{}).Where("emp_log_id = ?", markerID).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return nil
		}
		var concerts []models.Concert
		if err := tx.Select("concert_id").Order("concert_id").Find(&concerts).Error; err != nil {
			return err
		}
		if len(concerts) == 0 {
			return fmt.Errorf("at least one existing concert is required; no concerts were created or changed")
		}
		// PostgreSQL timestamp-without-time-zone approval columns are stored as UTC.
		now = now.UTC()
		bangkok := time.FixedZone("Asia/Bangkok", 7*60*60)
		local := now.In(bangkok)
		today := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
		staff := make([]models.User, len(employees))
		for i, spec := range employees {
			code := fmt.Sprintf("TEST-MGMT-%03d", i+1)
			staff[i] = models.User{
				UserID: fmt.Sprintf("%sEMP_%02d", prefix, i+1), FirstName: spec.name, LastName: "ข้อมูลจำลอง",
				DateOfBirth: time.Date(1995, 1, 1, 0, 0, 0, 0, time.UTC), Gender: "ไม่ระบุ",
				PhoneNumber: fmt.Sprintf("000000%04d", i+1), Email: fmt.Sprintf("staff%02d@management-demo.example.test", i+1),
				Address: "[ทดสอบ] บุคคลสมมติ ไม่ใช่ข้อมูลติดต่อจริง", CompanyName: "[ทดสอบ]",
				UserType: "employee", Role: spec.permission, EmployeeCode: &code, Department: spec.department,
				BaseModel: models.BaseModel{CreatedAt: now.AddDate(0, 0, -60), UpdatedAt: now.AddDate(0, 0, -60)},
			}
			if err := create(tx, &staff[i]); err != nil {
				return err
			}
			if err := create(tx, &models.Permission{
				PermissionID: fmt.Sprintf("%sPERM_%02d", prefix, i+1), UserID: staff[i].UserID,
				Position: "employee_management", PermissionName: spec.permission, Scope: spec.scope,
			}); err != nil {
				return err
			}
			if err := create(tx, &models.EmpActivityLogs{
				EmpLogID: fmt.Sprintf("%sSTAFF_CREATE_%02d", prefix, i+1), UserID: &staff[0].UserID,
				ActionType: "สร้าง", TargetID: staff[i].UserID, CreatedAt: staff[i].CreatedAt,
				Description: "[ทดสอบ] สร้างพนักงานจำลอง " + code + " สิทธิ์ " + spec.permission,
			}); err != nil {
				return err
			}
		}
		customers := make([]models.User, 3)
		for i, name := range []string{"ลูกค้าทดสอบเอ", "ลูกค้าทดสอบบี", "ลูกค้าทดสอบซี"} {
			customers[i] = models.User{
				UserID: fmt.Sprintf("%sCUS_%02d", prefix, i+1), FirstName: name, LastName: "ข้อมูลจำลอง",
				DateOfBirth: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), Gender: "ไม่ระบุ",
				PhoneNumber: fmt.Sprintf("000000%04d", i+101), Email: fmt.Sprintf("customer%02d@management-demo.example.test", i+1),
				Address: "[ทดสอบ] บุคคลสมมติ ไม่ใช่ข้อมูลติดต่อจริง", UserType: "customer", Role: "customer",
				BaseModel: models.BaseModel{CreatedAt: now.AddDate(0, 0, -60), UpdatedAt: now.AddDate(0, 0, -60)},
			}
			if err := create(tx, &customers[i]); err != nil {
				return err
			}
		}
		zonesByConcert := make(map[string][]models.Zone, len(concerts))
		for concertIndex, concert := range concerts {
			zones := []models.Zone{
				{ZoneID: fmt.Sprintf("%sC%02d_ZONE_VIP", prefix, concertIndex+1), ConcertID: concert.ConcertID, ZoneType: "VIP [ทดสอบ]", Capacity: 100, ZonePrice: 3500},
				{ZoneID: fmt.Sprintf("%sC%02d_ZONE_A", prefix, concertIndex+1), ConcertID: concert.ConcertID, ZoneType: "โซน A [ทดสอบ]", Capacity: 300, ZonePrice: 2500},
				{ZoneID: fmt.Sprintf("%sC%02d_ZONE_STANDING", prefix, concertIndex+1), ConcertID: concert.ConcertID, ZoneType: "ยืน [ทดสอบ]", Capacity: 500, ZonePrice: 1500},
			}
			for i := range zones {
				if err := create(tx, &zones[i]); err != nil {
					return err
				}
			}
			zonesByConcert[concert.ConcertID] = zones
		}
		for i, spec := range promotions {
			concertID := concerts[i%len(concerts)].ConcertID
			if err := seedPromotion(tx, i, spec, concertID, staff, customers, zonesByConcert[concertID], today, now); err != nil {
				return err
			}
		}
		for i, action := range []string{"ติดต่อโฆษณา", "ประสานงาน", "ซื้อบัตรคอนเสิร์ต"} {
			if err := create(tx, &models.CusActivityLogs{
				CusLogID: fmt.Sprintf("%sCUS_OTHER_%02d", prefix, i+1), UserID: customers[i].UserID,
				ActionType: action, Description: "[ทดสอบ] ตัวอย่างประวัติ " + action + " ไม่มีธุรกรรมหรือการติดต่อจริง",
				TargetID: fmt.Sprintf("%sPROMO_%02d", prefix, i+1), CreatedAt: now.Add(-time.Duration(i+1) * time.Hour),
			}); err != nil {
				return err
			}
		}
		// Written last in the SAME transaction; rerunning cannot resurrect deleted demos.
		if err := create(tx, &models.EmpActivityLogs{
			EmpLogID: markerID, ActionType: "สร้าง", CreatedAt: now,
			Description: "[ทดสอบ] ติดตั้งชุดข้อมูลจำลอง 4 เมนู: โปรโมชั่น การอนุมัติ ประวัติ และสิทธิ์พนักงาน (DEMO_MGMT_V1)",
		}); err != nil {
			return err
		}
		created = true
		return nil
	})
	return created && err == nil, err
}

func seedPromotion(tx *gorm.DB, index int, spec promotionSpec, concertID string, staff, customers []models.User, zones []models.Zone, today, now time.Time) error {
	id := fmt.Sprintf("%sPROMO_%02d", prefix, index+1)
	start, end := today.AddDate(0, 0, -7), today.AddDate(0, 0, 30)
	createdAt := start.AddDate(0, 0, -3)
	if spec.status == "expired" {
		start, end = today.AddDate(0, 0, -45), today.AddDate(0, 0, -15)
		createdAt = start.AddDate(0, 0, -3)
	} else if spec.status == "draft" {
		start, end = today.AddDate(0, 0, 1), today.AddDate(0, 0, 45)
		createdAt = now.Add(-time.Duration(index+6) * time.Hour)
	}
	logs := make([]models.PromotionUsageLog, spec.used)
	var revenue float64
	for i := range logs {
		customer, zone := customers[i%len(customers)], zones[i%len(zones)]
		price := float64(2000 + (i%3)*500)
		discount := spec.value
		if spec.discountType == "percent" {
			discount = price * spec.value / 100
			if spec.cap > 0 && discount > spec.cap {
				discount = spec.cap
			}
		}
		logs[i] = models.PromotionUsageLog{
			UsageLogID: fmt.Sprintf("%sUSE_%02d_%02d", prefix, index+1, i+1), PromotionID: id,
			UsedAt: start.AddDate(0, 0, 1+i%5).Add(time.Duration(8+i/5) * time.Hour),
			UserID: customer.UserID, UserName: customer.FirstName + " " + customer.LastName,
			OrderID: fmt.Sprintf("TEST-MGMT-ORDER-%02d-%02d", index+1, i+1), PurchasedZone: zone.ZoneType,
			FinalAmount: price - discount, DiscountAmount: discount,
		}
		revenue += logs[i].FinalAmount
	}
	promotion := models.Promotion{
		PromotionID: id, PromotionName: "[ทดสอบ] " + spec.name, ConcertID: concertID,
		Description:    "[ทดสอบ] ข้อมูลจำลองสำหรับทดลองรายการ รายละเอียด การแก้ไข และการอนุมัติ ไม่ใช่แคมเปญจริง",
		BannerImageUrl: []byte{}, Status: spec.status, ZoneType: "multiple", TotalRevenue: revenue,
		CreatedAt: createdAt, UpdatedAt: createdAt.Add(2 * time.Hour),
	}
	// The application reserves promo codes case-insensitively, including archived records.
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended('management-promo-code:' || UPPER(BTRIM(CAST(? AS text))), 0))", spec.code).Error; err != nil {
		return err
	}
	var duplicate int64
	if err := tx.Model(&models.DiscountInfo{}).Where("UPPER(BTRIM(promo_code)) = UPPER(BTRIM(CAST(? AS text)))", spec.code).Count(&duplicate).Error; err != nil {
		return err
	}
	if duplicate != 0 {
		return fmt.Errorf("demo promo code %s is already used; refusing to overwrite it", spec.code)
	}
	for _, row := range []any{
		&promotion,
		&models.DiscountInfo{DiscountID: fmt.Sprintf("%sDISCOUNT_%02d", prefix, index+1), PromotionID: id, DiscountType: spec.discountType, DiscountValue: spec.value, MinOrderValue: 1000, MaxDiscountAmount: spec.cap, PromoCode: spec.code},
		&models.Quota{QuotaID: fmt.Sprintf("%sQUOTA_%02d", prefix, index+1), PromotionID: id, StartDate: start, EndDate: end, TicketQuota: 200, UsedQuota: spec.used},
		&models.PromoCondition{ConditionID: fmt.Sprintf("%sCONDITION_%02d", prefix, index+1), PromotionID: id, MaxUsagePerUser: 5, ConditionDetail: "[ทดสอบ] ใช้ได้ทุกโซนที่เลือก ยอดขั้นต่ำ 1,000 บาท จำกัด 5 ครั้งต่อคน ไม่สามารถใช้ร่วมกับส่วนลดอื่น ข้อมูลนี้ใช้ทดสอบเท่านั้น"},
	} {
		if err := create(tx, row); err != nil {
			return err
		}
	}
	if err := tx.Model(&promotion).Omit("Zones.*").Association("Zones").Append(zones); err != nil {
		return err
	}
	requester, approver := staff[2], staff[0]
	approval := models.PromotionApproval{
		ApprovalID: fmt.Sprintf("%sAPPROVAL_%02d", prefix, index+1), PromotionID: id,
		RequestedBy: requester.FirstName + " " + requester.LastName, RequestedAt: createdAt.Add(time.Hour),
		StatusApproved: spec.approval, Remark: "[ทดสอบ] รอพิจารณา สามารถทดลองอนุมัติหรือปฏิเสธได้",
	}
	if spec.approval != "pending" {
		decidedAt := createdAt.Add(2 * time.Hour)
		approval.ApprovedAt, approval.UserID = &decidedAt, &approver.UserID
		approval.ApprovedBy = approver.FirstName + " " + approver.LastName
		approval.Remark = "[ทดสอบ] อนุมัติข้อมูลจำลองสำหรับทดสอบการแสดงผล"
		if spec.approval == "rejected" {
			approval.Remark = "[ทดสอบ] ส่วนลดเกินงบตัวอย่าง กรุณาปรับมูลค่าและส่งอนุมัติใหม่"
		}
		action := "APPROVE_PROMOTION"
		if spec.approval == "rejected" {
			action = "REJECT_PROMOTION"
		}
		if err := create(tx, &models.EmpActivityLogs{
			EmpLogID: fmt.Sprintf("%sDECIDE_%02d", prefix, index+1), UserID: &approver.UserID,
			ActionType: action, TargetID: id, CreatedAt: decidedAt, Description: approval.Remark + " — " + promotion.PromotionName,
		}); err != nil {
			return err
		}
	}
	if err := create(tx, &approval); err != nil {
		return err
	}
	if err := create(tx, &models.EmpActivityLogs{
		EmpLogID: fmt.Sprintf("%sCREATE_%02d", prefix, index+1), UserID: &requester.UserID,
		ActionType: "CREATE_PROMOTION", TargetID: id, CreatedAt: createdAt, Description: "สร้างโปรโมชั่น " + promotion.PromotionName,
	}); err != nil {
		return err
	}
	for i := range logs {
		if err := create(tx, &logs[i]); err != nil {
			return err
		}
		if err := create(tx, &models.CusActivityLogs{
			CusLogID: fmt.Sprintf("%sCUS_USE_%02d_%02d", prefix, index+1, i+1), UserID: logs[i].UserID,
			ActionType: "ซื้อบัตร", TargetID: id, CreatedAt: logs[i].UsedAt,
			Description: "[ทดสอบ] จำลองใช้รหัส " + spec.code + " เลขรายการ " + logs[i].OrderID + " ไม่มีการจองหรือชำระเงินจริง",
		}); err != nil {
			return err
		}
	}
	return nil
}
