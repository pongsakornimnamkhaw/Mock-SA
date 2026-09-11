package seed

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"backend/internal/access"
	"backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	DemoPassword = "Octavia@2026"
	seedLockKey  = "OCTAVIA_SERVER_ACCOUNTS_V1"
)

type EmployeeSpec struct {
	ID, FirstName, LastName, EmployeeCode, Department, Email, Phone, AccountRole, JobRole, PersonnelType string
	BirthDate                                                                                            time.Time
	Gender, Address                                                                                      string
	ModulePermissions                                                                                    map[access.Module]access.Level
}

type CustomerSpec struct {
	ID, FirstName, LastName, Email, Phone, Gender, Address string
	BirthDate                                              time.Time
}

func DemoAccountSpecs() ([]EmployeeSpec, []CustomerSpec) {
	birth := func(year int, month time.Month, day int) time.Time {
		return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	}
	employees := []EmployeeSpec{
		{"SEED_EMP_001", "อารยา", "วงศ์สวัสดิ์", "OCT-EMP-001", "ฝ่ายบุคคล", "araya.admin@octavia.test", "0811000001", "admin", "staff", "internal", birth(1988, 2, 14), "หญิง", "กรุงเทพมหานคร", nil},
		{"SEED_EMP_002", "ธนกร", "ศรีวิไล", "OCT-EMP-002", "ฝ่ายโปรดักชั่น", "thanakorn.organizer@octavia.test", "0811000002", "edit", "organizer", "internal", birth(1990, 6, 8), "ชาย", "นนทบุรี", nil},
		{"SEED_EMP_003", "ปาริชาติ", "รุ่งเรือง", "OCT-EMP-003", "ฝ่ายโปรดักชั่น", "parichat.coorganizer@octavia.test", "0811000003", "edit", "co_organizer", "internal", birth(1992, 9, 21), "หญิง", "ปทุมธานี", nil},
		{"SEED_EMP_004", "กิตติพงษ์", "แสงทอง", "OCT-EMP-004", "ฝ่ายโปรดักชั่น", "kittipong.artist@octavia.test", "0811000004", "edit", "organizer", "external", birth(1987, 12, 3), "ชาย", "สมุทรปราการ", map[access.Module]access.Level{access.Concerts: access.View, access.Artists: access.Edit}},
		{"SEED_EMP_005", "ศิริพร", "มั่นคง", "OCT-EMP-005", "ฝ่ายสถานที่", "siriporn.venue@octavia.test", "0811000005", "edit", "staff", "internal", birth(1994, 3, 17), "หญิง", "กรุงเทพมหานคร", nil},
		{"SEED_EMP_006", "ณัฐวุฒิ", "ใจดี", "OCT-EMP-006", "ฝ่ายสตาฟ", "nattawut.staff@octavia.test", "0811000006", "edit", "event_staff", "external", birth(1998, 7, 25), "ชาย", "ชลบุรี", nil},
		{"SEED_EMP_007", "ชลธิชา", "พัฒนกิจ", "OCT-EMP-007", "ฝ่ายการตลาด", "chonthicha.marketing@octavia.test", "0811000007", "edit", "staff", "internal", birth(1993, 5, 11), "หญิง", "กรุงเทพมหานคร", map[access.Module]access.Level{access.ConcertCatalog: access.Edit, access.Promotions: access.Edit, access.PromotionApprovals: access.View}},
		{"SEED_EMP_008", "วิชาญ", "ธรรมคุณ", "OCT-EMP-008", "ฝ่ายบริหาร", "wichan.approver@octavia.test", "0811000008", "edit", "approver", "internal", birth(1982, 10, 4), "ชาย", "กรุงเทพมหานคร", map[access.Module]access.Level{access.PromotionApprovals: access.Edit}},
		{"SEED_EMP_009", "มนัสวี", "สุขเกษม", "OCT-EMP-009", "ฝ่ายขาย", "manaswee.sales@octavia.test", "0811000009", "edit", "sales", "internal", birth(1995, 1, 29), "หญิง", "นนทบุรี", map[access.Module]access.Level{access.Sales: access.Edit}},
		{"SEED_EMP_010", "ภาคภูมิ", "รัตนชัย", "OCT-EMP-010", "ฝ่ายการเงิน", "phakphum.viewer@octavia.test", "0811000010", "view_only", "staff", "internal", birth(1996, 11, 16), "ชาย", "ปทุมธานี", nil},
	}
	customers := []CustomerSpec{
		{"SEED_CUS_001", "สมชาย", "จันทร์เพ็ญ", "somchai.customer@octavia.test", "0822000001", "ชาย", "เขตบางรัก กรุงเทพมหานคร", birth(1991, 1, 12)},
		{"SEED_CUS_002", "พิมพ์ชนก", "วัฒนากุล", "pimchanok.customer@octavia.test", "0822000002", "หญิง", "เขตจตุจักร กรุงเทพมหานคร", birth(1996, 4, 23)},
		{"SEED_CUS_003", "ณัฐชา", "เกียรติไพบูลย์", "natcha.customer@octavia.test", "0822000003", "หญิง", "อำเภอเมือง เชียงใหม่", birth(1999, 8, 9)},
		{"SEED_CUS_004", "ภูริณัฐ", "พงศ์พิพัฒน์", "phurinat.customer@octavia.test", "0822000004", "ชาย", "อำเภอเมือง ขอนแก่น", birth(1989, 2, 28)},
		{"SEED_CUS_005", "รินรดา", "บุญส่ง", "rinrada.customer@octavia.test", "0822000005", "หญิง", "อำเภอหาดใหญ่ สงขลา", birth(1994, 12, 6)},
		{"SEED_CUS_006", "วรเมธ", "ตั้งเจริญ", "woramet.customer@octavia.test", "0822000006", "ชาย", "อำเภอศรีราชา ชลบุรี", birth(1992, 6, 19)},
		{"SEED_CUS_007", "กัญญาวีร์", "สุนทรภักดี", "kanyavee.customer@octavia.test", "0822000007", "หญิง", "อำเภอเมือง นครราชสีมา", birth(2000, 3, 14)},
		{"SEED_CUS_008", "ธีรภัทร", "อุดมทรัพย์", "teerapat.customer@octavia.test", "0822000008", "ชาย", "อำเภอเมือง ภูเก็ต", birth(1987, 9, 30)},
		{"SEED_CUS_009", "ศศิธร", "แก้วประเสริฐ", "sasithorn.customer@octavia.test", "0822000009", "หญิง", "อำเภอเมือง นครปฐม", birth(1997, 7, 7)},
		{"SEED_CUS_010", "อชิรวิชญ์", "เลิศวาณิช", "achirawit.customer@octavia.test", "0822000010", "ชาย", "อำเภอเมือง ระยอง", birth(1993, 10, 18)},
	}
	return employees, customers
}

func EnsureDemoAccounts(db *gorm.DB) error {
	employees, customers := DemoAccountSpecs()
	hash, err := bcrypt.GenerateFromPassword([]byte(DemoPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash demo password: %w", err)
	}
	now := time.Now().UTC()
	return db.Transaction(func(tx *gorm.DB) error {
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", seedLockKey).Error; err != nil {
				return err
			}
		}
		for _, spec := range employees {
			if err := verifySeedIDOwner(tx, spec.ID, spec.Email, "employee", spec.EmployeeCode); err != nil {
				return err
			}
			if err := ensureEmailAvailable(tx, spec.ID, spec.Email); err != nil {
				return err
			}
			if err := ensureEmployeeCodeAvailable(tx, spec.ID, spec.EmployeeCode); err != nil {
				return err
			}
			code := spec.EmployeeCode
			user := models.User{UserID: spec.ID, FirstName: spec.FirstName, LastName: spec.LastName, DateOfBirth: spec.BirthDate, Gender: spec.Gender, PhoneNumber: spec.Phone, Address: spec.Address, Email: spec.Email, PasswordHash: string(hash), UserType: "employee", Role: spec.AccountRole, JobRole: spec.JobRole, EmployeeCode: &code, Department: spec.Department, PersonnelType: spec.PersonnelType, BaseModel: models.BaseModel{CreatedAt: now, UpdatedAt: now}}
			if err := upsertSeedUser(tx, &user); err != nil {
				return err
			}
			if err := tx.Where("user_id = ?", spec.ID).Delete(&models.Permission{}).Error; err != nil {
				return err
			}
			scope := ""
			if spec.AccountRole == "admin" {
				scope = "all"
			}
			if err := tx.Create(&models.Permission{PermissionID: spec.ID + "_ACCOUNT", UserID: spec.ID, Position: "employee_management", PermissionName: spec.AccountRole, Scope: scope}).Error; err != nil {
				return err
			}
			modules := make([]string, 0, len(spec.ModulePermissions))
			for module := range spec.ModulePermissions {
				modules = append(modules, string(module))
			}
			sort.Strings(modules)
			for _, key := range modules {
				level := spec.ModulePermissions[access.Module(key)]
				permission := models.Permission{PermissionID: spec.ID + "_MODULE_" + key, UserID: spec.ID, Position: "module:" + key, PermissionName: string(level), Scope: "global"}
				if err := tx.Create(&permission).Error; err != nil {
					return err
				}
			}
		}
		for _, spec := range customers {
			if err := verifySeedIDOwner(tx, spec.ID, spec.Email, "customer", ""); err != nil {
				return err
			}
			if err := ensureEmailAvailable(tx, spec.ID, spec.Email); err != nil {
				return err
			}
			user := models.User{UserID: spec.ID, FirstName: spec.FirstName, LastName: spec.LastName, DateOfBirth: spec.BirthDate, Gender: spec.Gender, PhoneNumber: spec.Phone, Address: spec.Address, Email: spec.Email, PasswordHash: string(hash), UserType: "customer", Role: "customer", JobRole: "staff", BaseModel: models.BaseModel{CreatedAt: now, UpdatedAt: now}}
			if err := upsertSeedUser(tx, &user); err != nil {
				return err
			}
		}
		return nil
	})
}

func verifySeedIDOwner(tx *gorm.DB, id, email, userType, employeeCode string) error {
	var existing models.User
	err := tx.First(&existing, "user_id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return validateExistingSeedIdentity(existing, id, email, userType, employeeCode)
}

func validateExistingSeedIdentity(existing models.User, id, email, userType, employeeCode string) error {
	existingCode := ""
	if existing.EmployeeCode != nil {
		existingCode = *existing.EmployeeCode
	}
	if existing.UserID != id || !strings.EqualFold(existing.Email, email) || !strings.EqualFold(existing.UserType, userType) || !strings.EqualFold(existingCode, employeeCode) {
		return fmt.Errorf("seed ID %s is occupied by an unrelated account; refusing to overwrite it", id)
	}
	return nil
}

func ensureEmailAvailable(tx *gorm.DB, id, email string) error {
	var count int64
	if err := tx.Model(&models.User{}).Where("LOWER(email) = LOWER(?) AND user_id <> ?", email, id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("seed email %s is already used by another account", email)
	}
	return nil
}

func ensureEmployeeCodeAvailable(tx *gorm.DB, id, code string) error {
	var count int64
	if err := tx.Model(&models.User{}).Where("UPPER(employee_code) = UPPER(?) AND user_id <> ?", code, id).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("seed employee code %s is already used by another account", code)
	}
	return nil
}

func upsertSeedUser(tx *gorm.DB, user *models.User) error {
	return tx.Omit(clause.Associations).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"first_name", "last_name", "date_of_birth", "gender", "phone_number", "address", "email", "password_hash", "user_type", "role", "job_role", "employee_code", "department", "employee_inactive", "personnel_type", "updated_at"}),
	}).Create(user).Error
}
