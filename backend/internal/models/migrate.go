package models

import "gorm.io/gorm"

func ticketPlanningTableNames() []string {
	return []string{
		(Concert{}).TableName(),
		(PerformanceSchedule{}).TableName(),
		(Zone{}).TableName(),
		(Seat{}).TableName(),
		(Publication{}).TableName(),
		(LayoutObject{}).TableName(),
		(Ticket{}).TableName(),
	}
}

// MigrateAllModels รัน AutoMigrate สำหรับ model ทั้งหมดในระบบ
func MigrateAllModels(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.AutoMigrate(
			// User & Access
			&User{},
			&CusActivityLogs{},
			&EmpActivityLogs{},
			&Permission{},
			&Inquiry{},

			// Concert
			&Concert{},
			&PerformanceSchedule{},
			&Zone{},
			&Seat{},
			&Publication{},
			&LayoutObject{},
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
			&TicketCategory{},
			&TicketSalesInfo{},
			&Ticket{},
			&GateCheckIn{},
			&SalesReport{},

			// Performance
			&PerformanceDetail{},

			// Work
			&WorkPlan{},
			&SponsorshipRequest{},
			&Task{},
		); err != nil {
			return err
		}
		return normalizeOperationalDateTimeColumns(tx)
	})
}

// normalizeOperationalDateTimeColumns keeps business dates and clock values
// timezone-free. Audit timestamps (created_at/updated_at) are intentionally untouched.
func normalizeOperationalDateTimeColumns(db *gorm.DB) error {
	statements := []string{
		`ALTER TABLE "Concert" ALTER COLUMN start_time TYPE time without time zone USING start_time::time`,
		`ALTER TABLE "Concert" ALTER COLUMN end_time TYPE time without time zone USING end_time::time`,
		`ALTER TABLE "PerformanceSchedule" ALTER COLUMN start_show TYPE time without time zone USING start_show::time`,
		`ALTER TABLE "PerformanceSchedule" ALTER COLUMN end_show TYPE time without time zone USING end_show::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN start_req TYPE time without time zone USING start_req::time`,
		`ALTER TABLE artist_requirements ALTER COLUMN end_req TYPE time without time zone USING end_req::time`,
		`ALTER TABLE work_plans ALTER COLUMN update_date TYPE date USING update_date::date`,
		`ALTER TABLE sponsorship_requests ALTER COLUMN submit_date TYPE date USING submit_date::date`,
		`ALTER TABLE ticket_sales_infos ALTER COLUMN publish_date TYPE date USING publish_date::date`,
		`ALTER TABLE sales_reports ALTER COLUMN report_date TYPE date USING report_date::date`,
	}
	for _, statement := range statements {
		if err := db.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}
