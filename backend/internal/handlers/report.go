package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// RegisterReportRoutes exposes the database-backed data used by the external
// planning page and the post-concert report.  Keeping these queries server-side
// also prevents the browser from having to understand the database relations.
func RegisterReportRoutes(app *fiber.App, db *gorm.DB) {
	h := &reportHandler{db: db}
	api := app.Group("/api")
	api.Get("/reports/concerts", h.listConcertReports)
	api.Get("/concerts/:id/poster", h.getConcertPoster)
	api.Get("/work-plans/current", h.getCurrentWorkPlan)
	api.Put("/work-plans/current", h.saveCurrentWorkPlan)
	api.Post("/work-plans/current/submit", h.submitCurrentWorkPlan)
}

func (h *reportHandler) getConcertPoster(c *fiber.Ctx) error {
	var concert models.Concert
	if err := h.db.Select("poster", "concert_poster").First(&concert, "concert_id = ?", c.Params("id")).Error; err != nil {
		return c.SendStatus(404)
	}
	data := concert.Poster
	if len(data) == 0 {
		data = concert.ConcertPoster
	}
	if len(data) == 0 {
		return c.SendStatus(404)
	}
	contentType := "image/jpeg"
	if bytes.HasPrefix(data, []byte{0x89, 0x50, 0x4e, 0x47}) {
		contentType = "image/png"
	}
	if bytes.HasPrefix(data, []byte("RIFF")) && bytes.Contains(data[:min(len(data), 16)], []byte("WEBP")) {
		contentType = "image/webp"
	}
	c.Set("Content-Type", contentType)
	c.Set("Cache-Control", "public, max-age=3600")
	return c.Send(data)
}

type reportHandler struct{ db *gorm.DB }

type reportZone struct {
	Zone      string  `json:"zone"`
	SeatsSold int64   `json:"seats_sold"`
	Revenue   float64 `json:"revenue"`
}

type concertReport struct {
	ID            string       `json:"id"`
	Title         string       `json:"title"`
	StartDate     string       `json:"start_date"`
	EndDate       string       `json:"end_date"`
	Location      string       `json:"location"`
	Status        string       `json:"status"`
	LastUpdate    time.Time    `json:"last_update"`
	PosterURL     string       `json:"poster_url"`
	TicketsSold   int64        `json:"tickets_sold"`
	TicketRevenue float64      `json:"ticket_revenue"`
	Zones         []reportZone `json:"zones"`
}

func (h *reportHandler) listConcertReports(c *fiber.Ctx) error {
	var concerts []models.Concert
	// A report is useful once an event has ended. Include explicitly completed
	// concerts as well, because imported data may not have perfect end dates.
	today := time.Now().Format("2006-01-02")
	if err := h.db.Where("end_date <= ? OR status IN ?", today, []string{"เสร็จสิ้น", "ตรวจสอบข้อมูลเสร็จสิ้น"}).
		Order("end_date DESC, concert_id DESC").Find(&concerts).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "ไม่สามารถอ่านรายงานคอนเสิร์ตได้"})
	}

	result := make([]concertReport, 0, len(concerts))
	for _, concert := range concerts {
		row := concertReport{ID: concert.ConcertID, Title: concert.ConcertName, StartDate: concert.StartDate,
			EndDate: concert.EndDate, Location: concert.Location, Status: reportStatus(concert.Status),
			LastUpdate: concert.UpdatedAt, PosterURL: fmt.Sprintf("/api/concerts/%s/poster", concert.ConcertID), Zones: []reportZone{}}

		// Ticket -> Seat is the authoritative link from a sale to its concert/zone.
		type zoneAggregate struct {
			ZoneID string
			Sold   int64
		}
		var aggregates []zoneAggregate
		if err := h.db.Table("tickets t").Select("s.zone_id, COUNT(DISTINCT t.ticket_id) AS sold").
			Joins("JOIN seats s ON s.seat_id = t.seat_id").
			Where("s.concert_id = ? AND LOWER(t.status_ticket) NOT IN ?", concert.ConcertID, []string{"cancelled", "canceled", "ยกเลิก"}).
			Group("s.zone_id").Scan(&aggregates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "ไม่สามารถสรุปยอดขายบัตรได้"})
		}
		for _, aggregate := range aggregates {
			var zone models.Zone
			zoneName := aggregate.ZoneID
			if h.db.First(&zone, "zone_id = ?", aggregate.ZoneID).Error == nil && zone.ZoneType != "" {
				zoneName = zone.ZoneType
			}
			var price float64
			h.db.Model(&models.TicketCategory{}).Where("zone_id = ?", aggregate.ZoneID).Select("COALESCE(MAX(price), 0)").Scan(&price)
			revenue := price * float64(aggregate.Sold)
			row.TicketsSold += aggregate.Sold
			row.TicketRevenue += revenue
			row.Zones = append(row.Zones, reportZone{Zone: zoneName, SeatsSold: aggregate.Sold, Revenue: revenue})
		}
		result = append(result, row)
	}
	return c.JSON(result)
}

func reportStatus(status string) string {
	if status == "กำลังตรวจสอบข้อมูล" {
		return status
	}
	return "ตรวจสอบข้อมูลเสร็จสิ้น"
}

type scheduleEntry struct {
	ID      string `json:"id"`
	Date    string `json:"date"`
	Time    string `json:"time"`
	Officer string `json:"officer"`
	Task    string `json:"task"`
}

type workPlanPayload struct {
	ConcertID string          `json:"concert_id"`
	Schedule  []scheduleEntry `json:"schedule"`
}

type timelineEntry struct {
	ID     int    `json:"id"`
	Title  string `json:"title"`
	Time   string `json:"time,omitempty"`
	Status string `json:"status"`
}

func (h *reportHandler) selectedConcert(c *fiber.Ctx) (*models.Concert, error) {
	id := strings.TrimSpace(c.Query("concert_id"))
	var concert models.Concert
	q := h.db.Order("start_date ASC, concert_id ASC")
	if id != "" {
		q = h.db.Where("concert_id = ?", id)
	}
	if err := q.First(&concert).Error; err != nil {
		return nil, err
	}
	return &concert, nil
}

func (h *reportHandler) getCurrentWorkPlan(c *fiber.Ctx) error {
	concert, err := h.selectedConcert(c)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบคอนเสิร์ต"})
	}
	var plan models.WorkPlan
	err = h.db.Where("concert_id = ?", concert.ConcertID).Order("update_date DESC, plan_id DESC").First(&plan).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return c.Status(500).JSON(fiber.Map{"error": "ไม่สามารถอ่านแผนงานได้"})
	}
	entries := []scheduleEntry{}
	if plan.ScheduleDetail != "" {
		_ = json.Unmarshal([]byte(plan.ScheduleDetail), &entries)
	}
	return c.JSON(fiber.Map{"plan_id": plan.PlanID, "concert_id": concert.ConcertID, "concert_name": concert.ConcertName,
		"schedule": entries, "approval_status": plan.ApprovalStatus, "timeline": buildTimeline(plan.ApprovalStatus, plan.UpdateDate)})
}

func (h *reportHandler) saveCurrentWorkPlan(c *fiber.Ctx) error   { return h.persistWorkPlan(c, false) }
func (h *reportHandler) submitCurrentWorkPlan(c *fiber.Ctx) error { return h.persistWorkPlan(c, true) }

func (h *reportHandler) persistWorkPlan(c *fiber.Ctx, submit bool) error {
	var payload workPlanPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลแผนงานไม่ถูกต้อง"})
	}
	if len(payload.Schedule) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุตารางการดำเนินการอย่างน้อย 1 รายการ"})
	}
	concert, err := h.selectedConcert(c)
	if payload.ConcertID != "" {
		c.Context().URI().QueryArgs().Set("concert_id", payload.ConcertID)
		concert, err = h.selectedConcert(c)
	}
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบคอนเสิร์ต"})
	}
	detail, _ := json.Marshal(payload.Schedule)
	now := time.Now()
	status := "ร่าง"
	if submit {
		status = "กำลังตรวจสอบข้อมูล"
	}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var plan models.WorkPlan
		find := tx.Where("concert_id = ?", concert.ConcertID).Order("update_date DESC, plan_id DESC").First(&plan).Error
		if find == gorm.ErrRecordNotFound {
			plan = models.WorkPlan{ConcertID: concert.ConcertID, Budget: 0}
		} else if find != nil {
			return find
		}
		plan.ScheduleDetail, plan.ApprovalStatus, plan.UpdateDate = string(detail), status, now
		if err := tx.Save(&plan).Error; err != nil {
			return err
		}
		return tx.Create(&models.ModifiedHistory{ConcertID: concert.ConcertID, ActionType: "WORK_PLAN", Description: "บันทึกแผนงาน: " + status, CreatedAt: now}).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "บันทึกแผนงานไม่สำเร็จ"})
	}
	return c.JSON(fiber.Map{"message": "บันทึกแผนงานสำเร็จ", "approval_status": status, "timeline": buildTimeline(status, now)})
}

func buildTimeline(status string, updated time.Time) []timelineEntry {
	titles := []string{"ส่งคำขออนุมัติสำเร็จ", "กำลังตรวจสอบข้อมูล", "ตรวจสอบข้อมูลเสร็จสิ้น", "รอเงินอนุมัติ", "เสร็จสิ้น"}
	stage := map[string]int{"ร่าง": -1, "กำลังตรวจสอบข้อมูล": 1, "ตรวจสอบข้อมูลเสร็จสิ้น": 2, "รอเงินอนุมัติ": 3, "เสร็จสิ้น": 4}[status]
	rows := make([]timelineEntry, 0, len(titles))
	for i, title := range titles {
		state := "pending"
		if i < stage {
			state = "completed"
		}
		if i == stage {
			state = "current"
		}
		row := timelineEntry{ID: i + 1, Title: title, Status: state}
		if i <= stage && !updated.IsZero() {
			row.Time = updated.Format("15.04 น. 02/01/2006")
		}
		rows = append(rows, row)
	}
	return rows
}
