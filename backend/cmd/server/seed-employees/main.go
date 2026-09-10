// seed-employees installs demo employee accounts for local back-office development.
// Accounts can log in to the employee system immediately after seeding.
// All demo IDs start with DEMO_EMP_V1_; employee codes start with DEMO-EMP-.
// Run from backend: go run ./cmd/seed-employees --apply
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"backend/internal/config"
	"backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

const prefix = "DEMO_EMP_V1_"
const markerID = prefix + "SEED_COMPLETE"

type empSpec struct {
	firstName  string
	lastName   string
	code       string
	department string
	email      string
	phone      string
	role       string // "admin" | "sales" | "staff"
	scope      string
	password   string
	personnel  string // "internal" | "external"
}

// Demo accounts — passwords shown in plaintext here for developer convenience.
// These are inserted as proper bcrypt hashes; the plaintext is NEVER stored.
var accounts = []empSpec{
	{
		firstName: "แอดมิน", lastName: "ตัวอย่าง",
		code: "DEMO-EMP-001", department: "ฝ่ายบุคคล",
		email: "admin.demo@octavia.test", phone: "0800000001",
		role: "admin", scope: "all", password: "Admin1234!", personnel: "internal",
	},
	{
		firstName: "ผู้จัดการ", lastName: "ตัวอย่าง",
		code: "DEMO-EMP-002", department: "ฝ่ายการตลาด",
		email: "manager.demo@octavia.test", phone: "0800000002",
		role: "admin", scope: "all", password: "Admin1234!", personnel: "internal",
	},
	{
		firstName: "พนักงาน", lastName: "แก้ไขได้",
		code: "DEMO-EMP-003", department: "ฝ่ายการตลาด",
		email: "editor.demo@octavia.test", phone: "0800000003",
		role: "staff", scope: "promotions", password: "Staff1234!", personnel: "internal",
	},
	{
		firstName: "พนักงาน", lastName: "ดูอย่างเดียว",
		code: "DEMO-EMP-004", department: "ฝ่ายการเงิน",
		email: "viewer.demo@octavia.test", phone: "0800000004",
		role: "staff", scope: "", password: "Staff1234!", personnel: "internal",
	},
	{
		firstName: "พงศกร", lastName: "อิ่มน้ำขาว",
		code: "B6728786", department: "ฝ่ายขาย",
		email: "sales.b6728786@octavia.test", phone: "0812345678",
		role: "sales", scope: "all", password: "Demo1234!", personnel: "internal",
	},
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func main() {
	apply := flag.Bool("apply", false, "Insert demo employee accounts into the database configured in backend/.env")
	flag.Parse()

	if !*apply {
		fmt.Println("Preview: demo employee accounts for back-office login")
		fmt.Println()
		fmt.Printf("%-16s %-12s %-8s %-36s %s\n", "รหัสพนักงาน", "บทบาท", "ประเภท", "อีเมล", "รหัสผ่าน")
		fmt.Println("─────────────────────────────────────────────────────────────────────────────")
		for _, a := range accounts {
			fmt.Printf("%-16s %-12s %-8s %-36s %s\n", a.code, a.role, a.personnel, a.email, a.password)
		}
		fmt.Println()
		fmt.Println("Run from backend: go run ./cmd/seed-employees --apply")
		fmt.Println("Development only. All IDs start with DEMO_EMP_V1_. Runs once; repeated runs are skipped.")
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

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	created, err := seed(db.WithContext(ctx))
	if err != nil {
		fmt.Fprintln(os.Stderr, "Employee seed failed; all inserts rolled back:", err)
		os.Exit(1)
	}
	if !created {
		fmt.Println("Demo employee accounts already installed. Skipped all writes.")
		fmt.Println("To reset: DELETE FROM emp_activity_logs WHERE emp_log_id = '" + markerID + "'; DELETE FROM users WHERE user_id LIKE 'DEMO_EMP_V1_%';")
		return
	}

	fmt.Printf("Created %d demo employee accounts.\n", len(accounts))
	fmt.Println()
	fmt.Printf("%-16s %-12s %-36s %s\n", "รหัสพนักงาน", "บทบาท", "อีเมล", "รหัสผ่าน")
	fmt.Println("───────────────────────────────────────────────────────────────────────")
	for _, a := range accounts {
		fmt.Printf("%-16s %-12s %-36s %s\n", a.code, a.role, a.email, a.password)
	}
	fmt.Println()
	fmt.Println("Login at: http://localhost:5173/employee/login")
	fmt.Println("Use employee code OR email as username.")
}

func seed(db *gorm.DB) (bool, error) {
	created := false
	now := time.Now().UTC()

	err := db.Transaction(func(tx *gorm.DB) error {
		// Advisory lock prevents concurrent/repeated installs
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext(?))", prefix).Error; err != nil {
			return err
		}

		// Check if already seeded
		var count int64
		if err := tx.Model(&models.EmpActivityLogs{}).Where("emp_log_id = ?", markerID).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return nil
		}

		for i, spec := range accounts {
			// Check for email collision with existing accounts
			var existing models.User
			emailErr := tx.Select("user_id").Where("LOWER(email) = LOWER(?)", spec.email).First(&existing).Error
			if emailErr == nil {
				return fmt.Errorf("email %s already used by user %s; refusing to overwrite", spec.email, existing.UserID)
			}

			// Check for employee code collision
			var existingCode models.User
			codeErr := tx.Select("user_id").Where("UPPER(employee_code) = UPPER(?)", spec.code).First(&existingCode).Error
			if codeErr == nil {
				return fmt.Errorf("employee code %s already used by user %s; refusing to overwrite", spec.code, existingCode.UserID)
			}

			hash, err := hashPassword(spec.password)
			if err != nil {
				return fmt.Errorf("bcrypt failed for %s: %w", spec.code, err)
			}

			userID := fmt.Sprintf("%sEMP_%02d", prefix, i+1)
			code := spec.code
			user := models.User{
				UserID:        userID,
				FirstName:     spec.firstName,
				LastName:      spec.lastName,
				DateOfBirth:   time.Date(1995, 1, 1, 0, 0, 0, 0, time.UTC),
				Gender:        "ไม่ระบุ",
				PhoneNumber:   spec.phone,
				Email:         spec.email,
				PasswordHash:  hash,
				UserType:      "employee",
				Role:          spec.role,
				EmployeeCode:  &code,
				Department:    spec.department,
				PersonnelType: spec.personnel,
				Address:       "[ทดสอบ] บุคคลสมมติ ไม่ใช่ข้อมูลติดต่อจริง",
				BaseModel: models.BaseModel{
					CreatedAt: now.AddDate(0, 0, -7),
					UpdatedAt: now.AddDate(0, 0, -7),
				},
			}

			if err := tx.Omit(clause.Associations).Create(&user).Error; err != nil {
				return fmt.Errorf("insert user %s: %w", spec.code, err)
			}

			permName := spec.role
			if permName == "admin" {
				permName = "admin"
			} else if permName == "sales" {
				permName = "edit"
			} else {
				permName = "view_only"
			}

			if err := tx.Omit(clause.Associations).Create(&models.Permission{
				PermissionID:   fmt.Sprintf("%sPERM_%02d", prefix, i+1),
				UserID:         userID,
				Position:       "employee_management",
				PermissionName: permName,
				Scope:          spec.scope,
			}).Error; err != nil {
				return fmt.Errorf("insert permission for %s: %w", spec.code, err)
			}
		}

		// Completion marker — same transaction, prevents partial installs
		if err := tx.Omit(clause.Associations).Create(&models.EmpActivityLogs{
			EmpLogID:    markerID,
			ActionType:  "สร้าง",
			CreatedAt:   now,
			Description: fmt.Sprintf("[ทดสอบ] ติดตั้งบัญชีพนักงานจำลอง %d บัญชี (DEMO_EMP_V1) สำหรับ local development", len(accounts)),
		}).Error; err != nil {
			return err
		}

		created = true
		return nil
	})
	return created && err == nil, err
}
