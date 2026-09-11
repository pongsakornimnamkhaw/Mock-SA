package models

import (
	"fmt"

	"gorm.io/gorm"
)

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	if err := prepareSeatColumnTypes(db); err != nil {
		return err
	}
	if err := db.AutoMigrate(
		// User & Access
		&User{},
		&CusActivityLogs{},
		&EmpActivityLogs{},
		&EmployeePasswordResetRequest{},
		&Permission{},
		&Inquiry{},

		// Concert
		&Concert{},
		&ConcertArtist{},
		&ConcertDocument{},
		&ModifiedHistory{},
		&SummaryReport{},

		// Artist
		&Artist{},
		&ArtistRequirement{},
		&ArtistHistory{},

		// Promotion
		&Promotion{},
		&PromotionApproval{},
		&PromoCondition{},
		&DiscountInfo{},
		&Quota{},
		&PromotionUsageLog{},

		// Ticket & Booking
		&Booking{},
		&Payment{},
		&Zone{},
		&Seat{},
		&TicketCategory{},
		&TicketSalesInfo{},
		&Ticket{},
		&GateCheckIn{},
		&SalesReport{},

		// Performance
		&PerformanceSchedule{},
		&PerformanceDetail{},

		// Work
		&WorkPlan{},
		&SponsorshipRequest{},
		&Task{},

		// Venue Seat Plan
		&VenueSeatPlan{},
		&VenueSeatRound{},
		&VenueSeatZone{},
		&VenueSeat{},
		&VenueLayoutObject{},
		&VenueSeatPublication{},
	); err != nil {
		return err
	}
	if err := db.Model(&User{}).
		Where("(LOWER(user_type) IN ? OR employee_code IS NOT NULL) AND COALESCE(personnel_type, '') = ''", []string{"employee", "staff", "admin", "พนักงาน"}).
		Update("personnel_type", PersonnelTypeInternal).Error; err != nil {
		return err
	}
	if err := normalizeOperationalDateTimeColumns(db); err != nil {
		return err
	}
	return ensureForeignKeyConstraints(db)
}

type foreignKeyDefinition struct {
	name, table, column, referencedTable, referencedColumn string
	onDelete                                               string
}

// ensureForeignKeyConstraints creates database-level relationships explicitly.
//
// GORM's automatic relationship inference is disabled in config/database.go because
// several models use the same UserID field on both sides. In that situation GORM
// previously generated reversed constraints such as users.user_id -> permissions.user_id.
// PostgreSQL (and pgAdmin's ERD tool) only knows relationships that exist as real FK
// constraints, so these definitions are deliberately kept explicit and idempotent.
func ensureForeignKeyConstraints(db *gorm.DB) error {
	foreignKeys := []foreignKeyDefinition{
		// Users and access
		{"fk_app_cus_activity_logs_user", "cus_activity_logs", "user_id", "users", "user_id", "CASCADE"},
		{"fk_app_emp_activity_logs_user", "emp_activity_logs", "user_id", "users", "user_id", "SET NULL"},
		{"fk_app_permissions_user", "permissions", "user_id", "users", "user_id", "CASCADE"},
		{"fk_app_inquiries_user", "inquiries", "user_id", "users", "user_id", "CASCADE"},
		{"fk_app_sales_reports_user", "sales_reports", "user_id", "users", "user_id", "RESTRICT"},
		{"fk_app_promotion_approvals_user", "promotion_approvals", "user_id", "users", "user_id", "SET NULL"},
		{"fk_app_password_resets_user", "employee_password_reset_requests", "user_id", "users", "user_id", "CASCADE"},
		{"fk_app_password_resets_approver", "employee_password_reset_requests", "approved_by", "users", "user_id", "SET NULL"},

		// Concerts and artists
		{"fk_app_concert_artists_concert", "concert_artists", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_concert_artists_artist", "concert_artists", "artist_id", "artists", "artist_id", "CASCADE"},
		{"fk_app_concert_documents_concert", "concert_documents", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_modified_histories_concert", "modified_histories", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_summary_reports_concert", "summary_reports", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_artist_histories_artist", "artist_histories", "artist_id", "artists", "artist_id", "SET NULL"},
		{"fk_app_artist_requirements_artist", "artist_requirements", "artist_id", "artists", "artist_id", "CASCADE"},
		{"fk_app_artist_requirements_concert", "artist_requirements", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_performance_schedules_concert", "performance_schedules", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_performance_details_schedule", "performance_details", "schedule_id", "performance_schedules", "schedule_id", "CASCADE"},

		// Promotions
		{"fk_app_promotions_concert", "promotions", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_promotion_approvals_promotion", "promotion_approvals", "promotion_id", "promotions", "promotion_id", "CASCADE"},
		{"fk_app_promo_conditions_promotion", "promo_conditions", "promotion_id", "promotions", "promotion_id", "CASCADE"},
		{"fk_app_discount_infos_promotion", "discount_infos", "promotion_id", "promotions", "promotion_id", "CASCADE"},
		{"fk_app_quota_promotion", "quota", "promotion_id", "promotions", "promotion_id", "CASCADE"},
		{"fk_app_promotion_usage_logs_promotion", "promotion_usage_logs", "promotion_id", "promotions", "promotion_id", "CASCADE"},
		{"fk_app_ticket_categories_promotion", "ticket_categories", "promotion_id", "promotions", "promotion_id", "SET NULL"},

		// Ticketing
		{"fk_app_bookings_user", "bookings", "user_id", "users", "user_id", "SET NULL"},
		{"fk_app_payments_booking", "payments", "booking_id", "bookings", "booking_id", "CASCADE"},
		{"fk_app_seats_concert", "seats", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_seats_zone", "seats", "zone_id", "zones", "zone_id", "CASCADE"},
		{"fk_app_ticket_categories_zone", "ticket_categories", "zone_id", "zones", "zone_id", "CASCADE"},
		{"fk_app_tickets_seat", "tickets", "seat_id", "seats", "seat_id", "RESTRICT"},
		{"fk_app_tickets_booking", "tickets", "booking_id", "bookings", "booking_id", "CASCADE"},

		// Work and venue layout
		{"fk_app_work_plans_concert", "work_plans", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_sponsorship_requests_concert", "sponsorship_requests", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_tasks_concert", "tasks", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_venue_seat_plans_concert", "venue_seat_plans", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_venue_seat_rounds_concert", "venue_seat_rounds", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_venue_seat_zones_concert", "venue_seat_zones", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_venue_seats_zone", "venue_seats", "zone_id", "venue_seat_zones", "zone_id", "CASCADE"},
		{"fk_app_venue_layout_objects_concert", "venue_layout_objects", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_venue_publications_concert", "venue_seat_publications", "concert_id", "concerts", "concert_id", "CASCADE"},
	}

	return db.Transaction(func(tx *gorm.DB) error {
		// Remove constraints produced in the wrong direction by older GORM migrations.
		for _, name := range []string{"fk_permissions_user", "fk_cus_activity_logs_user", "fk_emp_activity_logs_user"} {
			if err := tx.Exec(fmt.Sprintf(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "%s"`, name)).Error; err != nil {
				return err
			}
		}

		for _, fk := range foreignKeys {
			statement := fmt.Sprintf(`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f'
          AND n.nspname = current_schema()
          AND t.relname = '%s'
          AND c.conname = '%s'
    ) THEN
        ALTER TABLE "%s"
            ADD CONSTRAINT "%s" FOREIGN KEY ("%s")
            REFERENCES "%s" ("%s")
            ON UPDATE CASCADE ON DELETE %s NOT VALID;
    END IF;
END $$`, fk.table, fk.name, fk.table, fk.name, fk.column,
				fk.referencedTable, fk.referencedColumn, fk.onDelete)
			if err := tx.Exec(statement).Error; err != nil {
				return fmt.Errorf("create foreign key %s: %w", fk.name, err)
			}
		}
		return nil
	})
}

// normalizeOperationalDateTimeColumns keeps business dates and clock values
// timezone-free. This also normalises all created_at / updated_at audit
// columns to timestamp without time zone so every table is consistent.
func normalizeOperationalDateTimeColumns(db *gorm.DB) error {
	statements := []string{
		// ticket_categories.promotion_name/promotion_id becomes nullable: a category
		// projected from a seat layout (seat_inventory.go) has no promotion attached.
		// AutoMigrate does not reliably drop an existing NOT NULL, so do it explicitly.
		`ALTER TABLE ticket_categories ALTER COLUMN promotion_name DROP NOT NULL`,
		`ALTER TABLE ticket_categories ALTER COLUMN promotion_id DROP NOT NULL`,

		// operational time/date columns
		`ALTER TABLE concerts ALTER COLUMN start_time TYPE time without time zone USING start_time::time`,
		`ALTER TABLE concerts ALTER COLUMN end_time TYPE time without time zone USING end_time::time`,
		`ALTER TABLE performance_schedules ALTER COLUMN start_show TYPE time without time zone USING start_show::time`,
		`ALTER TABLE performance_schedules ALTER COLUMN end_show TYPE time without time zone USING end_show::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN start_req TYPE time without time zone USING start_req::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN end_req TYPE time without time zone USING end_req::time`,
		`ALTER TABLE venue_seat_rounds ALTER COLUMN door_time TYPE time without time zone USING door_time::time`,
		`ALTER TABLE work_plans ALTER COLUMN update_date TYPE date USING update_date::date`,
		`ALTER TABLE sponsorship_requests ALTER COLUMN submit_date TYPE date USING submit_date::date`,
		`ALTER TABLE ticket_sales_infos ALTER COLUMN publish_date TYPE date USING publish_date::date`,
		`ALTER TABLE sales_reports ALTER COLUMN report_date TYPE date USING report_date::date`,

		// audit timestamps — normalise to timestamp without time zone
		`ALTER TABLE users ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE users ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE cus_activity_logs ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE emp_activity_logs ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE concerts ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE concerts ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE artists ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE artists ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE artist_histories ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE promotions ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE promotions ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE promotion_usage_logs ALTER COLUMN used_at TYPE timestamp without time zone USING used_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE venue_seat_plans ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE venue_seat_plans ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE venue_seat_publications ALTER COLUMN created_at TYPE timestamp without time zone USING created_at AT TIME ZONE 'UTC'`,
		`ALTER TABLE venue_seat_publications ALTER COLUMN updated_at TYPE timestamp without time zone USING updated_at AT TIME ZONE 'UTC'`,
	}
	return db.Transaction(func(tx *gorm.DB) error {
		// Customer sessions now reuse cus_activity_logs. Remove the obsolete table
		// that an earlier version of the customer login feature created.
		if err := tx.Exec(`DROP TABLE IF EXISTS customer_auth_sessions`).Error; err != nil {
			return err
		}
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// MigrateVenueSeatModels รัน AutoMigrate เฉพาะตาราง Venue/Seat
// (ถูกเรียกใช้จาก main.go)
func MigrateVenueSeatModels(db *gorm.DB) error {
	return db.AutoMigrate(
		&Concert{},
		&VenueSeatPlan{},
		&VenueSeatRound{},
		&VenueSeatZone{},
		&VenueSeat{},
		&VenueLayoutObject{},
		&VenueSeatPublication{},
	)
}

// prepareSeatColumnTypes แปลง seats.seat_row / seat_column จาก integer เป็น varchar
// ต้องรันก่อน AutoMigrate เพราะ PostgreSQL แปลง integer → varchar ให้เองไม่ได้ ต้องระบุ USING
// ฟังก์ชันนี้ idempotent: ติดตั้งใหม่ (ยังไม่มีตาราง) หรือแปลงไปแล้ว จะไม่ทำอะไร
func prepareSeatColumnTypes(db *gorm.DB) error {
	var dataType string
	if err := db.Raw(
		`SELECT data_type FROM information_schema.columns
		 WHERE table_schema = current_schema() AND table_name = 'seats' AND column_name = 'seat_row'`,
	).Scan(&dataType).Error; err != nil {
		return err
	}
	if dataType == "" || dataType == "character varying" {
		return nil
	}
	return db.Exec(
		`ALTER TABLE seats
		   ALTER COLUMN seat_row TYPE varchar(50) USING seat_row::varchar,
		   ALTER COLUMN seat_column TYPE varchar(50) USING seat_column::varchar`,
	).Error
}
