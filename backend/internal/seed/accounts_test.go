package seed

import (
	"testing"

	"backend/internal/access"
	"backend/internal/models"
)

func TestDemoAccountSpecsContainTenUsableAccountsPerSide(t *testing.T) {
	employees, customers := DemoAccountSpecs()
	if len(employees) != 10 || len(customers) != 10 {
		t.Fatalf("account counts = employees:%d customers:%d; want 10 each", len(employees), len(customers))
	}

	emails := map[string]bool{}
	codes := map[string]bool{}
	roles := map[string]bool{}
	for _, employee := range employees {
		if employee.Email == "" || employee.EmployeeCode == "" || employee.FirstName == "" || employee.LastName == "" {
			t.Fatalf("employee has incomplete login/profile data: %#v", employee)
		}
		if emails[employee.Email] || codes[employee.EmployeeCode] {
			t.Fatalf("duplicate employee login: %s / %s", employee.Email, employee.EmployeeCode)
		}
		emails[employee.Email], codes[employee.EmployeeCode], roles[employee.JobRole] = true, true, true
	}
	for _, role := range []string{"organizer", "co_organizer", "event_staff", "approver", "sales"} {
		if !roles[role] {
			t.Fatalf("employee fixtures do not cover job role %q", role)
		}
	}
	for _, customer := range customers {
		if customer.Email == "" || customer.FirstName == "" || customer.LastName == "" || customer.Address == "" {
			t.Fatalf("customer has incomplete profile data: %#v", customer)
		}
		if emails[customer.Email] {
			t.Fatalf("duplicate account email: %s", customer.Email)
		}
		emails[customer.Email] = true
	}
}

func TestExistingSeedIdentityMustMatchBeforeUpdate(t *testing.T) {
	code := "OCT-EMP-001"
	expected := models.User{UserID: "SEED_EMP_001", Email: "araya.admin@octavia.test", UserType: "employee", EmployeeCode: &code}
	if err := validateExistingSeedIdentity(expected, "SEED_EMP_001", "araya.admin@octavia.test", "employee", "OCT-EMP-001"); err != nil {
		t.Fatalf("matching seed identity rejected: %v", err)
	}
	for _, existing := range []models.User{
		{UserID: "SEED_EMP_001", Email: "real.person@example.com", UserType: "employee", EmployeeCode: &code},
		{UserID: "SEED_EMP_001", Email: "araya.admin@octavia.test", UserType: "customer"},
	} {
		if err := validateExistingSeedIdentity(existing, "SEED_EMP_001", "araya.admin@octavia.test", "employee", "OCT-EMP-001"); err == nil {
			t.Fatalf("unrelated existing account was accepted: %#v", existing)
		}
	}
}

func TestEmployeeSpecsUseExplicitModulePermissions(t *testing.T) {
	employees, _ := DemoAccountSpecs()
	foundSales := false
	for _, employee := range employees {
		for module, level := range employee.ModulePermissions {
			if !module.Valid() || !level.Valid() {
				t.Fatalf("invalid permission for %s: %s=%s", employee.EmployeeCode, module, level)
			}
			if employee.JobRole == "sales" && module == access.Sales && level == access.Edit {
				foundSales = true
			}
		}
	}
	if !foundSales {
		t.Fatal("sales seed account must have explicit sales edit access")
	}
}
