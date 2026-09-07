package models

import "gorm.io/gorm"

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	if err := db.AutoMigrate(
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
	return normalizeOperationalDateTimeColumns(db)
}

// normalizeOperationalDateTimeColumns keeps business dates and clock values
// timezone-free. Audit timestamps (created_at/updated_at) are intentionally untouched.
func normalizeOperationalDateTimeColumns(db *gorm.DB) error {
	statements := []string{
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
