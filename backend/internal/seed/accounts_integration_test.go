package seed_test

import (
	"os"
	"testing"

	"backend/internal/config"
	"backend/internal/models"
	"backend/internal/seed"

	"golang.org/x/crypto/bcrypt"
)

func TestEnsureDemoAccountsAgainstConfiguredDatabase(t *testing.T) {
	if os.Getenv("SERVER_SEED_TEST") != "1" {
		t.Skip("set SERVER_SEED_TEST=1 to verify seed accounts in the configured PostgreSQL database")
	}
	config.LoadEnv()
	config.ConnectDB()
	if err := seed.EnsureDemoAccounts(config.DB); err != nil {
		t.Fatal(err)
	}
	if err := seed.EnsureDemoAccounts(config.DB); err != nil {
		t.Fatalf("second seed run must be idempotent: %v", err)
	}

	var employeeCount, customerCount int64
	if err := config.DB.Model(&models.User{}).Where("user_id LIKE ?", "SEED_EMP_%").Count(&employeeCount).Error; err != nil {
		t.Fatal(err)
	}
	if err := config.DB.Model(&models.User{}).Where("user_id LIKE ?", "SEED_CUS_%").Count(&customerCount).Error; err != nil {
		t.Fatal(err)
	}
	if employeeCount != 10 || customerCount != 10 {
		t.Fatalf("database counts = employees:%d customers:%d; want 10 each", employeeCount, customerCount)
	}

	var employee models.User
	if err := config.DB.Preload("Permissions").First(&employee, "user_id = ?", "SEED_EMP_009").Error; err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(employee.PasswordHash), []byte(seed.DemoPassword)) != nil {
		t.Fatal("seed employee cannot authenticate with the documented password")
	}
	foundSalesEdit := false
	for _, permission := range employee.Permissions {
		if permission.Position == "module:sales" && permission.PermissionName == "edit" {
			foundSalesEdit = true
		}
	}
	if !foundSalesEdit {
		t.Fatal("seed sales employee is missing explicit sales edit permission")
	}

	var customer models.User
	if err := config.DB.First(&customer, "user_id = ?", "SEED_CUS_001").Error; err != nil {
		t.Fatal(err)
	}
	if bcrypt.CompareHashAndPassword([]byte(customer.PasswordHash), []byte(seed.DemoPassword)) != nil {
		t.Fatal("seed customer cannot authenticate with the documented password")
	}
}
