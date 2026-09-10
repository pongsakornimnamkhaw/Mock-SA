package models

import (
	"strings"
	"testing"
)

func TestEmployeePasswordResetRequestBeforeCreate(t *testing.T) {
	request := EmployeePasswordResetRequest{}

	if err := request.BeforeCreate(nil); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(request.RequestID, "ER") {
		t.Fatalf("id=%q", request.RequestID)
	}
}

func TestPersonnelTypeConstants(t *testing.T) {
	if PersonnelTypeInternal != "internal" || PersonnelTypeExternal != "external" {
		t.Fatal("unexpected personnel type values")
	}
}

func TestEmployeeActivityLogAcceptsModule(t *testing.T) {
	log := EmpActivityLogs{Module: "คอนเสิร์ต"}
	if log.Module != "คอนเสิร์ต" {
		t.Fatalf("module=%q", log.Module)
	}
}
