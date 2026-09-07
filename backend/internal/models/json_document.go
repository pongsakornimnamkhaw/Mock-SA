package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// JSONDocument stores editor metadata as native JSONB on PostgreSQL while
// remaining portable to SQLite in unit tests.
type JSONDocument []byte

func (j JSONDocument) Value() (driver.Value, error) {
	if len(j) == 0 {
		return "[]", nil
	}
	if !json.Valid(j) {
		return nil, fmt.Errorf("invalid JSON document")
	}
	return string(j), nil
}

func (j *JSONDocument) Scan(value any) error {
	switch value := value.(type) {
	case nil:
		*j = JSONDocument("[]")
	case []byte:
		*j = append((*j)[:0], value...)
	case string:
		*j = append((*j)[:0], value...)
	default:
		return fmt.Errorf("cannot scan JSON document from %T", value)
	}
	return nil
}

func (JSONDocument) GormDataType() string { return "json" }

func (JSONDocument) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	if db.Dialector.Name() == "postgres" {
		return "JSONB"
	}
	return "TEXT"
}
