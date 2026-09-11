package handlers

import (
	"fmt"
	"strings"
	"time"

	"backend/internal/access"
	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ArtistHandler struct{ db *gorm.DB }

func RegisterArtistRoutes(app *fiber.App, db *gorm.DB) {
	h := &ArtistHandler{db: db}
	api := app.Group("/api")
	view := requireEmployeeModule(db, access.Artists, access.View)
	edit := requireEmployeeModule(db, access.Artists, access.Edit)
	api.Get("/artists", view, h.listArtists)
	api.Get("/artists/:id", view, h.getArtist)
	api.Post("/artists", edit, h.createArtist)
	api.Put("/artists/:id", edit, h.updateArtist)
	api.Delete("/artists/:id", edit, h.deleteArtist)
	api.Get("/artists/:id/invitations", view, h.listInvitations)
	api.Put("/artists/:id/invitations", edit, h.updateInvitations)
	api.Get("/performance-schedules", view, h.listSchedules)
	api.Post("/performance-schedules", edit, h.replaceSchedules)
	api.Put("/concerts/:id/performance-schedules", edit, h.replaceConcertSchedules)
	api.Get("/performance-details", view, h.listDetails)
	api.Post("/performance-details", edit, h.createDetail)
	api.Get("/artist-requirements", view, h.listRequirements)
	api.Post("/artist-requirements", edit, h.createRequirement)
	api.Get("/artist-history", view, h.listHistory)
	api.Get("/artist-dashboard", view, h.dashboard)
	h.seed()
}

func (h *ArtistHandler) history(kind, id, action, description string) {
	row := models.ArtistHistory{EntityType: kind, EntityID: id, Action: action, Description: description}
	if kind != "schedule" {
		artistID := id
		row.ArtistID = &artistID
	}
	h.db.Create(&row)
}

func (h *ArtistHandler) seed() {
	var count int64
	h.db.Model(&models.Artist{}).Count(&count)
	if count > 0 {
		return
	}
	artists := []models.Artist{
		{ArtistID: "AR0001", ArtistName: "PUN", ArtistType: "เดี่ยว", RecordLabel: "Warner Music", OfficialContact: "@pun_official", CoordinatorInfo: "คุณสมชาย ใจดี | 0812345678 | pun@warner.com", CoordinatorName: "คุณสมชาย ใจดี", CoordinatorPhone: "0812345678", CoordinatorEmail: "pun@warner.com", MoreInfo: "", Status: "ใช้งาน"},
		{ArtistID: "AR0002", ArtistName: "Slot Machine", ArtistType: "วงดนตรี", RecordLabel: "Tero Music", OfficialContact: "@slotmachine", CoordinatorInfo: "ฝ่ายประสานงาน Slot Machine", MoreInfo: "", Status: "ใช้งาน"},
		{ArtistID: "AR0003", ArtistName: "YOUNGGU", ArtistType: "เดี่ยว", RecordLabel: "อิสระ", OfficialContact: "@younggu", CoordinatorInfo: "ทีมงาน YOUNGGU", MoreInfo: "", Status: "ใช้งาน"},
		{ArtistID: "AR0004", ArtistName: "YOUNGOHM", ArtistType: "เดี่ยว", RecordLabel: "อิสระ", OfficialContact: "@youngohm", CoordinatorInfo: "ทีมงาน YOUNGOHM", MoreInfo: "", Status: "ใช้งาน"},
		{ArtistID: "AR0005", ArtistName: "URBOYTJ", ArtistType: "เดี่ยว", RecordLabel: "อิสระ", OfficialContact: "@urboytj", CoordinatorInfo: "ทีมงาน URBOYTJ", MoreInfo: "", Status: "ใช้งาน"},
	}
	for i := range artists {
		h.db.Create(&artists[i])
	}
}

func (h *ArtistHandler) listArtists(c *fiber.Ctx) error {
	var items []models.Artist
	q := h.db.Order("artist_name asc")
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		q = q.Where("LOWER(artist_name) LIKE ?", "%"+strings.ToLower(search)+"%")
	}
	if err := q.Find(&items).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(items)
}

func (h *ArtistHandler) getArtist(c *fiber.Ctx) error {
	var item models.Artist
	if err := h.db.First(&item, "artist_id = ?", c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบศิลปิน"})
	}
	return c.JSON(item)
}

func validateArtist(a *models.Artist) string {
	if strings.TrimSpace(a.ArtistName) == "" || strings.TrimSpace(a.RecordLabel) == "" || strings.TrimSpace(a.OfficialContact) == "" || strings.TrimSpace(a.CoordinatorName) == "" || strings.TrimSpace(a.CoordinatorPhone) == "" || strings.TrimSpace(a.CoordinatorEmail) == "" {
		return "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"
	}
	if !strings.Contains(a.CoordinatorEmail, "@") {
		return "รูปแบบอีเมลไม่ถูกต้อง"
	}
	return ""
}

func normalizeArtist(a *models.Artist) {
	a.CoordinatorInfo = strings.TrimSpace(a.CoordinatorName + " | " + a.CoordinatorPhone + " | " + a.CoordinatorEmail)
	if a.Status == "" {
		a.Status = "ใช้งาน"
	}
	if a.MoreInfo == "" {
		a.MoreInfo = "-"
	}
}

func (h *ArtistHandler) createArtist(c *fiber.Ctx) error {
	var item models.Artist
	if c.BodyParser(&item) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง"})
	}
	if msg := validateArtist(&item); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}
	normalizeArtist(&item)
	if err := h.db.Create(&item).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	h.history("artist", item.ArtistID, "CREATE", fmt.Sprintf("เพิ่มข้อมูลศิลปิน %s", item.ArtistName))
	return c.Status(201).JSON(item)
}

func (h *ArtistHandler) updateArtist(c *fiber.Ctx) error {
	var item models.Artist
	if h.db.First(&item, "artist_id = ?", c.Params("id")).Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบศิลปิน"})
	}
	id := item.ArtistID
	if c.BodyParser(&item) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง"})
	}
	item.ArtistID = id
	if msg := validateArtist(&item); msg != "" {
		return c.Status(400).JSON(fiber.Map{"error": msg})
	}
	normalizeArtist(&item)
	if err := h.db.Save(&item).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	h.history("artist", id, "UPDATE", fmt.Sprintf("แก้ไขข้อมูลศิลปิน %s", item.ArtistName))
	return c.JSON(item)
}

func (h *ArtistHandler) deleteArtist(c *fiber.Ctx) error {
	id := c.Params("id")
	var item models.Artist
	if h.db.First(&item, "artist_id = ?", id).Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบศิลปิน"})
	}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		artistID := id
		if err := tx.Create(&models.ArtistHistory{ArtistID: &artistID, EntityType: "artist", EntityID: id, Action: "DELETE", Description: fmt.Sprintf("ลบข้อมูลศิลปิน %s", item.ArtistName)}).Error; err != nil {
			return err
		}
		if err := tx.Where("artist_id = ?", id).Delete(&models.ConcertArtist{}).Error; err != nil {
			return err
		}
		if err := tx.Where("artist_id = ?", id).Delete(&models.ArtistRequirement{}).Error; err != nil {
			return err
		}
		if err := tx.Where("artist_id = ?", id).Delete(&models.PerformanceDetail{}).Error; err != nil {
			return err
		}
		if err := tx.Where("artist_id = ?", id).Delete(&models.PerformanceSchedule{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&item).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "ลบข้อมูลศิลปินไม่สำเร็จ: " + err.Error()})
	}
	return c.JSON(fiber.Map{"message": "ลบข้อมูลสำเร็จ", "artist_id": id})
}

type invitationResponse struct {
	ConcertID        string `json:"concert_id"`
	ConcertName      string `json:"concert_name"`
	StartDate        string `json:"start_date"`
	EndDate          string `json:"end_date"`
	StartTime        string `json:"start_time"`
	EndTime          string `json:"end_time"`
	Location         string `json:"location"`
	InvitationStatus string `json:"invitation_status"`
}

func (h *ArtistHandler) listInvitations(c *fiber.Ctx) error {
	var rows []invitationResponse
	h.db.Table("concerts").Select("concerts.concert_id, concerts.concert_name, concerts.start_date, concerts.end_date, concerts.start_time, concerts.end_time, concerts.location, COALESCE(concert_artists.invitation_status, 'รอการตอบรับ') AS invitation_status").Joins("LEFT JOIN concert_artists ON concert_artists.concert_id=concerts.concert_id AND concert_artists.artist_id=?", c.Params("id")).Order("concerts.start_date").Scan(&rows)
	for i := range rows {
		rows[i].StartDate = dateOnly(rows[i].StartDate)
		rows[i].EndDate = dateOnly(rows[i].EndDate)
		rows[i].StartTime = clockOnly(rows[i].StartTime)
		rows[i].EndTime = clockOnly(rows[i].EndTime)
	}
	return c.JSON(rows)
}

type invitationUpdate struct {
	ConcertID string `json:"concert_id"`
	Status    string `json:"status"`
}

func (h *ArtistHandler) updateInvitations(c *fiber.Ctx) error {
	var req struct {
		Invitations []invitationUpdate `json:"invitations"`
	}
	if c.BodyParser(&req) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง"})
	}
	id := c.Params("id")
	for _, x := range req.Invitations {
		if x.Status == "" {
			x.Status = "รอการตอบรับ"
		}
		row := models.ConcertArtist{ConcertID: x.ConcertID, ArtistID: id, InvitationStatus: x.Status}
		h.db.Where("concert_id=? AND artist_id=?", x.ConcertID, id).Assign(models.ConcertArtist{InvitationStatus: x.Status}).FirstOrCreate(&row)
	}
	h.history("invitation", id, "UPDATE", "อัปเดตสถานะคำเชิญศิลปิน")
	return c.JSON(fiber.Map{"message": "บันทึกข้อมูลสำเร็จ"})
}

func (h *ArtistHandler) listSchedules(c *fiber.Ctx) error {
	var rows []models.PerformanceSchedule
	q := h.db.Order("concert_id, show_date, performance_order").Preload("PerformanceDetails")
	if id := c.Query("concert_id"); id != "" {
		q = q.Where("concert_id=?", id)
	}
	if showDate := c.Query("show_date"); showDate != "" {
		q = q.Where("show_date=?", showDate)
	}
	if err := q.Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	for i := range rows {
		rows[i].StartShow = clockOnly(rows[i].StartShow)
		rows[i].EndShow = clockOnly(rows[i].EndShow)
		rows[i].ShowDate = dateOnly(rows[i].ShowDate)
	}
	return c.JSON(rows)
}

type scheduleInput struct {
	PerformanceOrder int    `json:"performance_order"`
	Details          string `json:"details"`
	StartShow        string `json:"start_show"`
	EndShow          string `json:"end_show"`
	ArtistID         string `json:"artist_id"`
	ShowDate         string `json:"show_date"`
}

func (h *ArtistHandler) replaceSchedules(c *fiber.Ctx) error {
	var req struct {
		ConcertID string          `json:"concert_id"`
		ShowDate  string          `json:"show_date"`
		Schedules []scheduleInput `json:"schedules"`
	}
	if c.BodyParser(&req) != nil || req.ConcertID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุคอนเสิร์ต"})
	}
	return h.saveSchedules(c, req.ConcertID, req.ShowDate, req.Schedules)
}
func (h *ArtistHandler) replaceConcertSchedules(c *fiber.Ctx) error {
	var req struct {
		ShowDate  string          `json:"show_date"`
		Schedules []scheduleInput `json:"schedules"`
	}
	if c.BodyParser(&req) != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ข้อมูลไม่ถูกต้อง"})
	}
	return h.saveSchedules(c, c.Params("id"), req.ShowDate, req.Schedules)
}
func (h *ArtistHandler) saveSchedules(c *fiber.Ctx, id, requestedShowDate string, inputs []scheduleInput) error {
	var concert models.Concert
	if h.db.First(&concert, "concert_id = ?", id).Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "ไม่พบคอนเสิร์ต"})
	}
	showDate := dateOnly(requestedShowDate)
	if showDate == "" && len(inputs) > 0 {
		showDate = dateOnly(inputs[0].ShowDate)
	}
	if showDate == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุวันที่ของตารางการแสดง"})
	}
	concertStartDate := dateOnly(concert.StartDate)
	concertEndDate := dateOnly(concert.EndDate)
	concertStart, startErr := parseClock(concert.StartTime)
	concertEnd, endErr := parseClock(concert.EndTime)
	if startErr != nil || endErr != nil {
		return c.Status(400).JSON(fiber.Map{"error": "เวลาเริ่มหรือเวลาสิ้นสุดของคอนเสิร์ตไม่ถูกต้อง"})
	}
	if showDate < concertStartDate || showDate > concertEndDate {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("วันที่แสดงต้องอยู่ระหว่าง %s ถึง %s", concertStartDate, concertEndDate)})
	}
	previousEnd := -1
	for index, item := range inputs {
		if dateOnly(item.ShowDate) != showDate {
			return c.Status(400).JSON(fiber.Map{"error": "กรุณาบันทึกตารางการแสดงครั้งละ 1 วัน"})
		}
		rowStart, err1 := parseClock(item.StartShow)
		rowEnd, err2 := parseClock(item.EndShow)
		if err1 != nil || err2 != nil || rowStart >= rowEnd {
			return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("เวลาเริ่มและสิ้นสุดของลำดับที่ %d ไม่ถูกต้อง", index+1)})
		}
		if rowStart < concertStart || rowEnd > concertEnd {
			return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("ลำดับที่ %d ต้องอยู่ในช่วงเวลาคอนเสิร์ต %s–%s", index+1, clockOnly(concert.StartTime)[:5], clockOnly(concert.EndTime)[:5])})
		}
		if previousEnd >= 0 && rowStart < previousEnd {
			return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("เวลาแสดงลำดับที่ %d ซ้อนกับลำดับก่อนหน้า", index+1)})
		}
		previousEnd = rowEnd
	}
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var existing []models.PerformanceSchedule
		if err := tx.Where("concert_id=? AND show_date=?", id, showDate).Find(&existing).Error; err != nil {
			return err
		}
		for _, schedule := range existing {
			if err := tx.Where("schedule_id=?", schedule.ScheduleID).Delete(&models.PerformanceDetail{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("concert_id=? AND show_date=?", id, showDate).Delete(&models.PerformanceSchedule{}).Error; err != nil {
			return err
		}
		for i, x := range inputs {
			if x.PerformanceOrder == 0 {
				x.PerformanceOrder = i + 1
			}
			row := models.PerformanceSchedule{ConcertID: id, PerformanceOrder: x.PerformanceOrder, Details: x.Details, StartShow: clockOnly(x.StartShow), EndShow: clockOnly(x.EndShow), ArtistID: x.ArtistID, ShowDate: showDate}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	action := "บันทึกตารางการแสดง"
	if len(inputs) == 0 {
		action = "ลบตารางการแสดงวันที่ " + showDate
	}
	h.history("schedule", id, "UPDATE", action)
	return c.JSON(fiber.Map{"message": action + "สำเร็จ"})
}

func parseClock(value string) (int, error) {
	value = clockOnly(value)
	for _, layout := range []string{"15:04:05", "15:04"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.Hour()*3600 + parsed.Minute()*60 + parsed.Second(), nil
		}
	}
	return 0, fmt.Errorf("invalid time %q", value)
}

func (h *ArtistHandler) listDetails(c *fiber.Ctx) error {
	var rows []models.PerformanceDetail
	q := h.db.Order("detail_id desc")
	if id := c.Query("artist_id"); id != "" {
		q = q.Where("artist_id=?", id)
	}
	q.Find(&rows)
	return c.JSON(rows)
}
func (h *ArtistHandler) createDetail(c *fiber.Ctx) error {
	var row models.PerformanceDetail
	if c.BodyParser(&row) != nil || row.ScheduleID == "" || row.ArtistID == "" || strings.TrimSpace(row.PerformanceDetails) == "" || strings.TrimSpace(row.StageInfo) == "" || strings.TrimSpace(row.SoundCheckInfo) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาเลือกตารางการแสดงและกรอกข้อมูลให้ครบถ้วน"})
	}
	var schedule models.PerformanceSchedule
	if h.db.First(&schedule, "schedule_id = ?", row.ScheduleID).Error != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบตารางการแสดงที่เลือก"})
	}
	if schedule.ArtistID != row.ArtistID {
		return c.Status(400).JSON(fiber.Map{"error": "ศิลปินไม่ตรงกับตารางการแสดงที่เลือก"})
	}
	if err := h.db.Create(&row).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	h.history("detail", row.ArtistID, "CREATE", "เพิ่มรายละเอียดการแสดง")
	return c.Status(201).JSON(row)
}
func (h *ArtistHandler) listRequirements(c *fiber.Ctx) error {
	var rows []models.ArtistRequirement
	q := h.db.Order("req_date desc")
	if id := c.Query("artist_id"); id != "" {
		q = q.Where("artist_id=?", id)
	}
	q.Find(&rows)
	for i := range rows {
		rows[i].ReqDate = dateOnly(rows[i].ReqDate)
		rows[i].StartReq = clockOnly(rows[i].StartReq)
		rows[i].EndReq = clockOnly(rows[i].EndReq)
	}
	return c.JSON(rows)
}
func (h *ArtistHandler) createRequirement(c *fiber.Ctx) error {
	var row models.ArtistRequirement
	if c.BodyParser(&row) != nil || row.ConcertID == "" || row.ArtistID == "" || row.Requirement == "" || row.ReqDate == "" || row.StartReq == "" || row.EndReq == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณากรอกข้อมูลให้ครบถ้วน"})
	}
	var concert models.Concert
	if h.db.First(&concert, "concert_id=?", row.ConcertID).Error != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบคอนเสิร์ต"})
	}
	row.ReqDate = dateOnly(row.ReqDate)
	if row.ReqDate < dateOnly(concert.StartDate) || row.ReqDate > dateOnly(concert.EndDate) {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("วันที่ต้องอยู่ระหว่าง %s ถึง %s", dateOnly(concert.StartDate), dateOnly(concert.EndDate))})
	}
	reqStart, startErr := parseClock(row.StartReq)
	reqEnd, endErr := parseClock(row.EndReq)
	concertStart, concertStartErr := parseClock(concert.StartTime)
	concertEnd, concertEndErr := parseClock(concert.EndTime)
	if startErr != nil || endErr != nil || concertStartErr != nil || concertEndErr != nil || reqStart >= reqEnd {
		return c.Status(400).JSON(fiber.Map{"error": "เวลาเริ่มและเวลาสิ้นสุดไม่ถูกต้อง"})
	}
	if reqStart < concertStart || reqEnd > concertEnd {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("เวลาต้องอยู่ในช่วง %s–%s ของคอนเสิร์ต", clockOnly(concert.StartTime)[:5], clockOnly(concert.EndTime)[:5])})
	}
	var a models.Artist
	if h.db.First(&a, "artist_id=?", row.ArtistID).Error != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ไม่พบศิลปิน"})
	}
	row.ArtistName = a.ArtistName
	row.StartReq = clockOnly(row.StartReq)
	row.EndReq = clockOnly(row.EndReq)
	if err := h.db.Create(&row).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	h.history("requirement", row.ArtistID, "CREATE", "เพิ่มความต้องการของศิลปิน "+a.ArtistName)
	return c.Status(201).JSON(row)
}
func (h *ArtistHandler) listHistory(c *fiber.Ctx) error {
	var rows []models.ArtistHistory
	q := h.db.Order("created_at desc")
	if id := c.Query("entity_id"); id != "" {
		q = q.Where("entity_id=?", id)
	}
	if createdDate := dateOnly(c.Query("date")); createdDate != "" {
		q = q.Where("DATE(created_at)=?", createdDate)
	}
	if err := q.Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(rows)
}
func (h *ArtistHandler) dashboard(c *fiber.Ctx) error {
	var artists, schedules, requirements int64
	h.db.Model(&models.Artist{}).Count(&artists)
	h.db.Model(&models.PerformanceSchedule{}).Count(&schedules)
	h.db.Model(&models.ArtistRequirement{}).Count(&requirements)
	var invitations []struct {
		ArtistName string `json:"artist_name"`
		Status     string `json:"status"`
	}
	h.db.Table("concert_artists").Select("artists.artist_name, concert_artists.invitation_status AS status").Joins("JOIN artists ON artists.artist_id=concert_artists.artist_id").Order("artists.artist_name").Limit(5).Scan(&invitations)
	var history []models.ArtistHistory
	h.db.Order("created_at desc").Limit(5).Find(&history)
	return c.JSON(fiber.Map{"artist_count": artists, "schedule_count": schedules, "requirement_count": requirements, "invitations": invitations, "history": history, "generated_at": time.Now()})
}
