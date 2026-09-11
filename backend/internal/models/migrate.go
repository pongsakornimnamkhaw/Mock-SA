package models

import (
	"gorm.io/gorm"
)

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	if err := detachOrphanEmployeeActivityUsers(db); err != nil {
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
	return normalizeOperationalDateTimeColumns(db)
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
