package models

import (
	"database/sql"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestApprovedMigrationModels(t *testing.T) {
	want := []string{
		"Concert",
		"PerformanceSchedule",
		"Zone",
		"Seat",
		"Publication",
		"LayoutObject",
		"Ticket",
	}
	if got := ticketPlanningTableNames(); !reflect.DeepEqual(got, want) {
		t.Fatalf("approved tables = %#v, want %#v", got, want)
	}
}

func TestMigrationPreservesUnmanagedTablesAndIsIdempotent(t *testing.T) {
	baseDSN := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		testEnv("DB_HOST", "localhost"),
		testEnv("DB_USER", "admin_T01SA"),
		testEnv("DB_PASSWORD", "T01SA"),
		testEnv("DB_NAME", "backend_T01"),
		testEnv("DB_PORT", "5432"),
		testEnv("DB_SSLMODE", "disable"),
	)
	admin, err := gorm.Open(postgres.Open(baseDSN), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Skipf("PostgreSQL is unavailable: %v", err)
	}

	schemaName := fmt.Sprintf("ticket_plan_test_%d", time.Now().UnixNano())
	if err := admin.Exec(fmt.Sprintf(`CREATE SCHEMA "%s"`, schemaName)).Error; err != nil {
		t.Skipf("cannot create isolated PostgreSQL schema: %v", err)
	}
	t.Cleanup(func() {
		_ = admin.Exec(fmt.Sprintf(`DROP SCHEMA IF EXISTS "%s" CASCADE`, schemaName)).Error
	})

	db, err := gorm.Open(postgres.Open(baseDSN+" search_path="+schemaName), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open isolated schema: %v", err)
	}

	legacyDDL := []string{
		`CREATE TABLE concerts (legacy_id integer PRIMARY KEY)`,
		`CREATE TABLE venue_seats (legacy_id integer PRIMARY KEY)`,
		`INSERT INTO venue_seats (legacy_id) VALUES (1)`,
	}
	for _, statement := range legacyDDL {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("create legacy fixture: %v", err)
		}
	}

	if err := MigrateAllModels(db); err != nil {
		t.Fatalf("first migration: %v", err)
	}
	for _, table := range ticketPlanningTableNames() {
		if !relationExists(t, db, table) {
			t.Errorf("approved table %q does not exist", table)
		}
	}
	for _, table := range []string{"concerts", "venue_seats"} {
		if !relationExists(t, db, table) {
			t.Errorf("unmanaged table %q was renamed or dropped", table)
		}
	}
	var legacySeatCount int64
	if err := db.Table("venue_seats").Count(&legacySeatCount).Error; err != nil {
		t.Fatalf("count unmanaged venue seats: %v", err)
	}
	if legacySeatCount != 1 {
		t.Fatalf("unmanaged venue_seats preserved %d rows, want 1", legacySeatCount)
	}

	concert := Concert{
		ConcertID: "CC-MIGRATION-TEST", ConcertName: "Migration Test", StartDate: "2026-09-07",
		EndDate: "2026-09-07", StartTime: "18:00:00", EndTime: "20:00:00",
		Location: "Test Hall", Status: "DRAFT", MoreInfo: "test",
	}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatalf("insert approved-table data: %v", err)
	}
	if err := MigrateAllModels(db); err != nil {
		t.Fatalf("second migration: %v", err)
	}
	var count int64
	if err := db.Model(&Concert{}).Where("concert_id = ?", concert.ConcertID).Count(&count).Error; err != nil {
		t.Fatalf("count preserved data: %v", err)
	}
	if count != 1 {
		t.Fatalf("second migration preserved %d rows, want 1", count)
	}
	if err := db.Table("venue_seats").Count(&legacySeatCount).Error; err != nil {
		t.Fatalf("count unmanaged venue seats after second migration: %v", err)
	}
	if legacySeatCount != 1 {
		t.Fatalf("second migration preserved %d unmanaged rows, want 1", legacySeatCount)
	}
}

func relationExists(t *testing.T, db *gorm.DB, table string) bool {
	t.Helper()
	lookup := table
	if table != strings.ToLower(table) || strings.Contains(table, "-") {
		lookup = `"` + table + `"`
	}
	var relation sql.NullString
	if err := db.Raw("SELECT to_regclass(?)::text", lookup).Scan(&relation).Error; err != nil {
		t.Fatalf("look up table %q: %v", table, err)
	}
	return relation.Valid
}

func testEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
