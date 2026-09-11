package models

import (
	"reflect"
	"testing"
)

func TestEmployeePasswordSetupModelExists(t *testing.T) {
	if _, ok := reflect.TypeOf(User{}).FieldByName("MustChangePassword"); !ok {
		t.Fatal("User.MustChangePassword is missing")
	}
	token := EmployeePasswordSetupToken{UserID: "U1", TokenHash: "hash"}
	if token.UsedAt != nil {
		t.Fatal("new setup token must be unused")
	}
}

func TestEmployeePasswordSetupTokenIsOneToOneWithUser(t *testing.T) {
	field, ok := reflect.TypeOf(EmployeePasswordSetupToken{}).FieldByName("UserID")
	if !ok || !containsAll(field.Tag.Get("gorm"), "uniqueIndex", "not null") {
		t.Fatal("EmployeePasswordSetupToken.UserID must be a required unique foreign key")
	}
}
