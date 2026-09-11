package handlers

import (
	"testing"

	"backend/internal/access"
	"backend/internal/models"
)

func TestEmployeeAccessLevelUsesModuleOverrides(t *testing.T) {
	user := models.User{
		UserID: "U1", Role: "staff", Department: "ฝ่ายการตลาด",
		Permissions: []models.Permission{{Position: "module:promotions", PermissionName: "none"}},
	}
	if got := employeeAccessLevel(user, access.Promotions); got != access.None {
		t.Fatalf("employeeAccessLevel()=%q want none", got)
	}
}

func TestEmployeeAccessLevelUsesJobRoleAndAccountCap(t *testing.T) {
	organizer := models.User{Role: "edit", JobRole: "organizer"}
	if got := employeeAccessLevel(organizer, access.Artists); got != access.Edit {
		t.Fatalf("organizer artist access=%q want edit", got)
	}
	viewOnlyOrganizer := models.User{Role: "view_only", JobRole: "organizer"}
	if got := employeeAccessLevel(viewOnlyOrganizer, access.Artists); got != access.View {
		t.Fatalf("view-only organizer artist access=%q want view", got)
	}
}

func TestEmployeeFeatureAccessUsesJobRoleAndAccountCap(t *testing.T) {
	organizer := models.User{Role: "edit", JobRole: "organizer"}
	if got := employeeFeatureAccessLevel(organizer, access.ConcertCreate); got != access.Edit {
		t.Fatalf("organizer create access=%q want edit", got)
	}
	organizer.Role = "view_only"
	if got := employeeFeatureAccessLevel(organizer, access.ConcertCreate); got != access.View {
		t.Fatalf("view-only organizer create access=%q want view cap", got)
	}
	finance := models.User{Role: "edit", JobRole: "finance"}
	if got := employeeFeatureAccessLevel(finance, access.ConcertDocuments); got != access.View {
		t.Fatalf("finance document access=%q want view", got)
	}
}
