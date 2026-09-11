package seed

import (
	"strings"

	"backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func employeeNeedsInitialPassword(user models.User) bool {
	isEmployee := strings.EqualFold(user.UserType, "employee") ||
		strings.EqualFold(user.UserType, "staff") ||
		strings.EqualFold(user.UserType, "admin") ||
		strings.EqualFold(user.UserType, "พนักงาน") || user.EmployeeCode != nil
	return isEmployee && !user.EmployeeInactive && user.PasswordHash == "" && strings.TrimSpace(user.PhoneNumber) != ""
}

// RepairMissingEmployeePasswords upgrades employee rows created by older
// server versions that stored account details without an initial password.
// Existing password hashes are never replaced.
func RepairMissingEmployeePasswords(db *gorm.DB) (int, error) {
	var users []models.User
	if err := db.Where("password_hash = ? AND employee_inactive = ? AND phone_number <> ? AND (LOWER(user_type) IN ? OR employee_code IS NOT NULL)",
		"", false, "", []string{"employee", "staff", "admin", "พนักงาน"}).Find(&users).Error; err != nil {
		return 0, err
	}

	repaired := 0
	for _, user := range users {
		if !employeeNeedsInitialPassword(user) {
			continue
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(user.PhoneNumber)), bcrypt.DefaultCost)
		if err != nil {
			return repaired, err
		}
		result := db.Model(&models.User{}).
			Where("user_id = ? AND password_hash = ? AND employee_inactive = ?", user.UserID, "", false).
			Updates(map[string]any{"password_hash": string(hash), "must_change_password": true})
		if result.Error != nil {
			return repaired, result.Error
		}
		repaired += int(result.RowsAffected)
	}
	return repaired, nil
}
