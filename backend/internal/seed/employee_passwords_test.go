package seed

import (
	"testing"

	"backend/internal/models"
)

func TestEmployeeNeedsInitialPassword(t *testing.T) {
	code := "EMP011"
	if !employeeNeedsInitialPassword(models.User{UserType: "employee", EmployeeCode: &code, PhoneNumber: "091919191", PasswordHash: ""}) {
		t.Fatal("employee with a phone and missing password must be repaired")
	}
	if employeeNeedsInitialPassword(models.User{UserType: "employee", EmployeeCode: &code, PhoneNumber: "091919191", PasswordHash: "existing-hash"}) {
		t.Fatal("existing password must never be replaced")
	}
	if employeeNeedsInitialPassword(models.User{UserType: "customer", PhoneNumber: "091919191", PasswordHash: ""}) {
		t.Fatal("customer accounts must not be changed")
	}
	if employeeNeedsInitialPassword(models.User{UserType: "employee", EmployeeCode: &code, PasswordHash: ""}) {
		t.Fatal("employee without a phone cannot receive a phone-based password")
	}
}
