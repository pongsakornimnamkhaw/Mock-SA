package models

import (
	"sync"
	"testing"

	"gorm.io/gorm/schema"
)

func TestUserHasManyRelationshipDirections(t *testing.T) {
	userSchema, err := schema.Parse(&User{}, &sync.Map{}, schema.NamingStrategy{})
	if err != nil {
		t.Fatalf("parse User schema: %v", err)
	}

	for relationName, foreignTable := range map[string]string{
		"Permissions":        "permissions",
		"CusActivityLogs":    "cus_activity_logs",
		"EmpActivityLogs":    "emp_activity_logs",
		"Inquiries":          "inquiries",
		"SalesReports":       "sales_reports",
		"PromotionApprovals": "promotion_approvals",
	} {
		relation := userSchema.Relationships.Relations[relationName]
		if relation == nil {
			t.Fatalf("%s relationship was not parsed", relationName)
		}
		if relation.Type != schema.HasMany {
			t.Fatalf("%s relationship type = %s, want %s", relationName, relation.Type, schema.HasMany)
		}
		if len(relation.References) != 1 {
			t.Fatalf("%s relationship has %d references, want 1", relationName, len(relation.References))
		}

		reference := relation.References[0]
		if reference.PrimaryKey.Schema != userSchema || reference.PrimaryKey.DBName != "user_id" {
			t.Fatalf("%s parent key = %s.%s, want users.user_id", relationName, reference.PrimaryKey.Schema.Table, reference.PrimaryKey.DBName)
		}
		if reference.ForeignKey.Schema.Table != foreignTable || reference.ForeignKey.DBName != "user_id" {
			t.Fatalf("%s foreign key = %s.%s, want %s.user_id", relationName, reference.ForeignKey.Schema.Table, reference.ForeignKey.DBName, foreignTable)
		}
	}
}
