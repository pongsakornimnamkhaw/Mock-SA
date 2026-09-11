package models

import (
	"fmt"
	"gorm.io/gorm"
)

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	if err := dropLegacyVenueSeatTables(db); err != nil {
		return err
	}
	if err := detachOrphanEmployeeActivityUsers(db); err != nil {
		return err
	}
	if err := dropManagedForeignKeyConstraints(db); err != nil {
		return err
	}
	if err := migrateLegacyNumericTicketIDs(db); err != nil {
		return err
	}
	// Build every table before adding relationship constraints. Several domain
	// models reference each other, so a single FK-enabled pass can target a
	// table that has not been created yet on a brand-new schema.
	foreignKeysDisabled := db.Config.DisableForeignKeyConstraintWhenMigrating
	db.Config.DisableForeignKeyConstraintWhenMigrating = true
	baseErr := db.AutoMigrate(allModels()...)
	db.Config.DisableForeignKeyConstraintWhenMigrating = foreignKeysDisabled
	if baseErr != nil {
		return baseErr
	}
	if err := ensureTicketPlanningConstraints(db); err != nil {
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

func dropLegacyVenueSeatTables(db *gorm.DB) error {
	return db.Exec(`
		DROP TABLE IF EXISTS venue_layout_objects CASCADE;
		DROP TABLE IF EXISTS venue_seats CASCADE;
		DROP TABLE IF EXISTS venue_seat_zones CASCADE;
		DROP TABLE IF EXISTS venue_seat_rounds CASCADE;
		DROP TABLE IF EXISTS venue_seat_publications CASCADE;
		DROP TABLE IF EXISTS venue_seat_plans CASCADE;
	`).Error
}

// migrateLegacyNumericTicketIDs preserves installations that used readable
// string IDs (for example ST_R01_A_0001). The current models use auto-increment
// numeric IDs, so related rows must be remapped together before AutoMigrate.
func migrateLegacyNumericTicketIDs(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var legacySeats, legacyTickets bool
		if err := tx.Raw(`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema() AND table_name = 'seats'
				  AND column_name = 'seat_id' AND data_type NOT IN ('smallint', 'integer', 'bigint')
			)`).Scan(&legacySeats).Error; err != nil {
			return err
		}
		if err := tx.Raw(`
			SELECT EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_schema = current_schema() AND table_name = 'tickets'
				  AND column_name = 'ticket_id' AND data_type NOT IN ('smallint', 'integer', 'bigint')
			)`).Scan(&legacyTickets).Error; err != nil {
			return err
		}
		if !legacySeats && !legacyTickets {
			return nil
		}

		// Foreign keys must be recreated after the referenced ID columns change type.
		if err := tx.Exec(`
DO $$
DECLARE constraint_row record;
BEGIN
    FOR constraint_row IN
        SELECT n.nspname AS schema_name, t.relname AS table_name, c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f' AND n.nspname = current_schema()
          AND c.confrelid IN ('seats'::regclass, 'tickets'::regclass)
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', constraint_row.schema_name, constraint_row.table_name, constraint_row.constraint_name);
    END LOOP;
END $$`).Error; err != nil {
			return err
		}

		if legacySeats {
			if err := tx.Exec(`
CREATE TEMP TABLE legacy_seat_id_map (old_id text PRIMARY KEY, new_id bigint UNIQUE) ON COMMIT DROP;
INSERT INTO legacy_seat_id_map (old_id, new_id)
SELECT seat_id::text, row_number() OVER (ORDER BY seat_id::text) FROM seats;

UPDATE tickets AS t SET seat_id = m.new_id::text
FROM legacy_seat_id_map AS m WHERE t.seat_id::text = m.old_id;
UPDATE seats AS s SET seat_id = m.new_id::text
FROM legacy_seat_id_map AS m WHERE s.seat_id::text = m.old_id;

ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_pkey;
ALTER TABLE seats ALTER COLUMN seat_id TYPE bigint USING seat_id::bigint;
ALTER TABLE tickets ALTER COLUMN seat_id TYPE bigint USING seat_id::bigint;
ALTER TABLE seats ADD CONSTRAINT seats_pkey PRIMARY KEY (seat_id);
CREATE SEQUENCE IF NOT EXISTS seats_seat_id_seq OWNED BY seats.seat_id;
ALTER TABLE seats ALTER COLUMN seat_id SET DEFAULT nextval('seats_seat_id_seq');
SELECT setval('seats_seat_id_seq', COALESCE((SELECT MAX(seat_id) FROM seats), 1), EXISTS (SELECT 1 FROM seats));`).Error; err != nil {
				return fmt.Errorf("migrate legacy seat IDs: %w", err)
			}
		}

		if legacyTickets {
			if err := tx.Exec(`
CREATE TEMP TABLE legacy_ticket_id_map (old_id text PRIMARY KEY, new_id bigint UNIQUE) ON COMMIT DROP;
INSERT INTO legacy_ticket_id_map (old_id, new_id)
SELECT ticket_id::text, row_number() OVER (ORDER BY ticket_id::text) FROM tickets;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'gate_check_ins' AND column_name = 'ticket_id'
    ) THEN
        EXECUTE 'UPDATE gate_check_ins AS g SET ticket_id = m.new_id::text FROM legacy_ticket_id_map AS m WHERE g.ticket_id::text = m.old_id';
    END IF;
END $$;
UPDATE tickets AS t SET ticket_id = m.new_id::text
FROM legacy_ticket_id_map AS m WHERE t.ticket_id::text = m.old_id;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_pkey;
ALTER TABLE tickets ALTER COLUMN ticket_id TYPE bigint USING ticket_id::bigint;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = 'gate_check_ins' AND column_name = 'ticket_id'
    ) THEN
        EXECUTE 'ALTER TABLE gate_check_ins ALTER COLUMN ticket_id TYPE bigint USING ticket_id::bigint';
    END IF;
END $$;
ALTER TABLE tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (ticket_id);
CREATE SEQUENCE IF NOT EXISTS tickets_ticket_id_seq OWNED BY tickets.ticket_id;
ALTER TABLE tickets ALTER COLUMN ticket_id SET DEFAULT nextval('tickets_ticket_id_seq');
SELECT setval('tickets_ticket_id_seq', COALESCE((SELECT MAX(ticket_id) FROM tickets), 1), EXISTS (SELECT 1 FROM tickets));`).Error; err != nil {
				return fmt.Errorf("migrate legacy ticket IDs: %w", err)
			}
		}
		return nil
	})
}

// dropManagedForeignKeyConstraints removes constraints created by
// ensureForeignKeyConstraints before GORM changes legacy column types. They are
// recreated from the current schema after AutoMigrate completes.
func dropManagedForeignKeyConstraints(db *gorm.DB) error {
	return db.Exec(`
DO $$
DECLARE
    constraint_row record;
BEGIN
    FOR constraint_row IN
        SELECT n.nspname AS schema_name, t.relname AS table_name, c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f'
          AND n.nspname = current_schema()
          AND c.conname LIKE 'fk_app_%'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            constraint_row.schema_name,
            constraint_row.table_name,
            constraint_row.constraint_name);
    END LOOP;
END $$`).Error
}

func allModels() []any {
	return []any{
		// User & Access
		&User{},
		&CusActivityLogs{},
		&EmpActivityLogs{},
		&EmployeePasswordResetRequest{},
		&EmployeePasswordSetupToken{},
		&Permission{},
		&Inquiry{},

		// Concert
		&Concert{},
		&ConcertArtist{},
		&ConcertDocument{},
		&ModifiedHistory{},
		&SummaryReport{},
		&PerformanceSchedule{},
		&PerformanceDetail{},
		&Publication{},
		&LayoutObject{},

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

		// Work
		&WorkPlan{},
		&SponsorshipRequest{},
		&Task{},
	}
}

func ensureTicketPlanningConstraints(db *gorm.DB) error {
	for _, statement := range ticketPlanningConstraintStatements() {
		if err := db.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func ticketPlanningConstraintStatements() []string {
	return []string{
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_zones_concert' AND conrelid = 'zones'::regclass) THEN ALTER TABLE zones ADD CONSTRAINT fk_zones_concert FOREIGN KEY (concert_id) REFERENCES concerts(concert_id) ON UPDATE CASCADE ON DELETE RESTRICT; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM zones WHERE concert_id IS NULL) THEN ALTER TABLE zones ALTER COLUMN concert_id SET NOT NULL; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_layout_objects_concert' AND conrelid = 'layout_objects'::regclass) THEN ALTER TABLE layout_objects ADD CONSTRAINT fk_layout_objects_concert FOREIGN KEY (concert_id) REFERENCES concerts(concert_id) ON UPDATE CASCADE ON DELETE CASCADE; END IF; END $$`,
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_publications_concert' AND conrelid = 'publications'::regclass) THEN ALTER TABLE publications ADD CONSTRAINT fk_publications_concert FOREIGN KEY (concert_id) REFERENCES concerts(concert_id) ON UPDATE CASCADE ON DELETE CASCADE; END IF; END $$`,
	}
}

// detachOrphanEmployeeActivityUsers repairs legacy audit/session rows created
// for synthetic employee accounts before GORM adds the users foreign key.
// Audit rows are retained; only their invalid optional reference is cleared.
func detachOrphanEmployeeActivityUsers(db *gorm.DB) error {
	var ready bool
	if err := db.Raw(`
		SELECT to_regclass(current_schema() || '.emp_activity_logs') IS NOT NULL
		   AND to_regclass(current_schema() || '.users') IS NOT NULL
		   AND EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = 'emp_activity_logs'
			  AND column_name = 'user_id'
		   )`).Scan(&ready).Error; err != nil {
		return err
	}
	if !ready {
		return nil
	}
	return db.Exec(`
		UPDATE emp_activity_logs AS logs
		SET user_id = NULL
		WHERE logs.user_id IS NOT NULL
		  AND NOT EXISTS (
			SELECT 1 FROM users WHERE users.user_id = logs.user_id
		  )`).Error
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
		{"fk_app_employee_password_setup_user", "employee_password_setup_tokens", "user_id", "users", "user_id", "CASCADE"},

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
		{"fk_app_gate_check_ins_ticket", "gate_check_ins", "ticket_id", "tickets", "ticket_id", "RESTRICT"},
		{"fk_app_ticket_sales_infos_seat", "ticket_sales_infos", "seat_id", "seats", "seat_id", "SET NULL"},

		// Work
		{"fk_app_work_plans_concert", "work_plans", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_sponsorship_requests_concert", "sponsorship_requests", "concert_id", "concerts", "concert_id", "CASCADE"},
		{"fk_app_tasks_concert", "tasks", "concert_id", "concerts", "concert_id", "CASCADE"},
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
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '%s'
          AND column_name = '%s'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = '%s'
          AND column_name = '%s'
    ) AND NOT EXISTS (
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
END $$`, fk.table, fk.column, fk.referencedTable, fk.referencedColumn,
				fk.table, fk.name, fk.table, fk.name, fk.column,
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
	}
	return db.Transaction(func(tx *gorm.DB) error {
		for _, statement := range statements {
			if err := tx.Exec(statement).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
