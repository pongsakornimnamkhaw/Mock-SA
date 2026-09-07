package models

import (
	"time"

	"gorm.io/gorm"
)

const venueSeatSchemaMigration = "20260904_replace_venue_seat_tables"

type schemaMigration struct {
	Version   string    `gorm:"primaryKey;type:varchar(100)"`
	AppliedAt time.Time `gorm:"not null"`
}

func (schemaMigration) TableName() string { return "backend_schema_migrations" }

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	if err := migrateWithVenueSeatReset(db,
		// User & Access
		&User{},
		&CusActivityLogs{},
		&EmpActivityLogs{},
		&Permission{},
		&Inquiry{},

		// Concert
		&Concert{},
		&ConcertArtist{},
		&ConcertDocument{},
		&ModifiedHistory{},
		&SummaryReport{},
		&Publication{},

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
		&GateCheckIn{},
		&Ticket{},
		&SalesReport{},

		// Performance
		&PerformanceSchedule{},
		&PerformanceDetail{},

		// Work
		&WorkPlan{},
		&SponsorshipRequest{},
		&Task{},
	); err != nil {
		return err
	}
	return normalizeOperationalDateTimeColumns(db)
}

// migrateWithVenueSeatReset performs the destructive replacement and the
// corresponding AutoMigrate in one PostgreSQL transaction. The marker is only
// written after the new schema is complete, so a failed migration remains safe
// to retry and a successful migration never drops seats/tickets again.
func migrateWithVenueSeatReset(db *gorm.DB, destination ...any) error {
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		return err
	}
	var count int64
	if err := db.Model(&schemaMigration{}).Where("version = ?", venueSeatSchemaMigration).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return db.AutoMigrate(destination...)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		for _, table := range []string{
			"tickets",
			"seats",
			"venue_seats",
			"venue_layout_objects",
			"venue_seat_publications",
			"venue_seat_rounds",
			"venue_seat_zones",
			"venue_seat_plans",
		} {
			if tx.Migrator().HasTable(table) {
				if err := tx.Migrator().DropTable(table); err != nil {
					return err
				}
			}
		}
		if err := tx.AutoMigrate(destination...); err != nil {
			return err
		}
		return tx.Create(&schemaMigration{Version: venueSeatSchemaMigration, AppliedAt: time.Now()}).Error
	})
}

// normalizeOperationalDateTimeColumns keeps business dates and clock values
// timezone-free. Audit timestamps (created_at/updated_at) are intentionally untouched.
func normalizeOperationalDateTimeColumns(db *gorm.DB) error {
	statements := []string{
		`ALTER TABLE concerts ALTER COLUMN start_time TYPE time without time zone USING start_time::time`,
		`ALTER TABLE concerts ALTER COLUMN end_time TYPE time without time zone USING end_time::time`,
		`ALTER TABLE concerts ALTER COLUMN time_open_gate TYPE time without time zone USING time_open_gate::time`,
		`ALTER TABLE performance_schedules ALTER COLUMN start_show TYPE time without time zone USING start_show::time`,
		`ALTER TABLE performance_schedules ALTER COLUMN end_show TYPE time without time zone USING end_show::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN start_req TYPE time without time zone USING start_req::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN end_req TYPE time without time zone USING end_req::time`,
		`ALTER TABLE work_plans ALTER COLUMN update_date TYPE date USING update_date::date`,
		`ALTER TABLE sponsorship_requests ALTER COLUMN submit_date TYPE date USING submit_date::date`,
		`ALTER TABLE ticket_sales_infos ALTER COLUMN publish_date TYPE date USING publish_date::date`,
		`ALTER TABLE sales_reports ALTER COLUMN report_date TYPE date USING report_date::date`,
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

// MigrateVenueSeatModels remains for callers that only need the canonical
// concert seating schema.
func MigrateVenueSeatModels(db *gorm.DB) error {
	return migrateWithVenueSeatReset(db,
		&Concert{},
		&Publication{},
		&Zone{},
		&Seat{},
		&Booking{},
		&TicketCategory{},
		&GateCheckIn{},
		&Ticket{},
	)
}
