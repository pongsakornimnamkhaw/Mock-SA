package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type ConcertHandler struct {
	db *gorm.DB
}

func clockOnly(value string) string {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed.In(time.FixedZone("ICT", 7*60*60)).Format("15:04:05")
	}
	if index := strings.Index(value, "T"); index >= 0 && len(value) >= index+9 {
		return value[index+1 : index+9]
	}
	return value
}

func dateOnly(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 10 && value[4] == '-' && value[7] == '-' {
		return value[:10]
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02 15:04:05Z07:00", "2006-01-02 15:04:05"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.Format("2006-01-02")
		}
	}
	return value
}

func RegisterConcertRoutes(app *fiber.App, db *gorm.DB) {
	handler := &ConcertHandler{db: db}

	// Auto seed default concerts if empty
	handler.seedDefaultData()

	api := app.Group("/api")

	// Concerts
	api.Get("/concerts", handler.listConcerts)
	api.Get("/concerts/:id", handler.getConcert)
	api.Post("/concerts", handler.createConcert)
	api.Put("/concerts/:id", handler.updateConcert)
	api.Delete("/concerts/:id", handler.deleteConcert)
	api.Put("/concerts/:id/status", handler.updateConcertStatus)
	api.Patch("/concerts/:id/status", handler.updateConcertStatus)

	// Tasks / Responsibility
	api.Get("/concerts/:id/tasks", handler.listTasks)
	api.Post("/concerts/:id/tasks", handler.createTask)
	api.Put("/tasks/:taskId/status", handler.updateTaskStatus)
	api.Patch("/tasks/:taskId/status", handler.updateTaskStatus)
	api.Put("/concerts/:id/tasks/:taskId/status", handler.updateTaskStatus)

	// Documents
	api.Get("/concerts/:id/documents", handler.listDocuments)
	api.Post("/concerts/:id/documents", handler.createDocument)
	api.Get("/documents/:docId/file", handler.getDocumentFile)
	api.Get("/documents/:docId/view", handler.getDocumentFile)
	api.Delete("/documents/:docId", handler.deleteDocument)

	// Edit History
	api.Get("/history", handler.listHistory)
	api.Get("/concerts/:id/history", handler.listHistoryByConcert)
}

func (h *ConcertHandler) seedDefaultData() {
	var count int64
	h.db.Model(&models.Concert{}).Count(&count)
	if count == 0 {
		c1 := models.Concert{
			ConcertID:   "CC0001",
			ConcertName: "Riverside Sound Festival",
			StartDate:   "2026-10-16",
			EndDate:     "2026-10-18",
			StartTime:   "18:00:00",
			EndTime:     "23:30:00",
			Location:    "ธันเดอร์โดม เมืองทองธานี",
			Status:      "ยืนยันแล้ว",
			MoreInfo:    "เทศกาลดนตรีริมแม่น้ำสุดยิ่งใหญ่",
		}
		c2 := models.Concert{
			ConcertID:   "CC0002",
			ConcertName: "Neon Nights Vol.3",
			StartDate:   "2026-11-16",
			EndDate:     "2026-11-18",
			StartTime:   "18:00:00",
			EndTime:     "23:30:00",
			Location:    "MCC Hall เดอะมอลล์บางกะปิ",
			Status:      "เลื่อนการจัด",
			MoreInfo:    "คอนเสิร์ตธีมนีออนสุดมันส์",
		}
		c3 := models.Concert{
			ConcertID:   "CC0003",
			ConcertName: "Acoustic Sessions: Bangkok",
			StartDate:   "2026-12-16",
			EndDate:     "2026-12-18",
			StartTime:   "18:00:00",
			EndTime:     "23:30:00",
			Location:    "Lido Connect",
			Status:      "ยกเลิกการจัด",
			MoreInfo:    "คอนเสิร์ตอะคูสติกบรรยากาศสบายๆ",
		}

		h.db.Create(&c1)
		h.db.Create(&c2)
		h.db.Create(&c3)

		// Seed initial history
		h.db.Create(&models.ModifiedHistory{
			HistoryID:   "MH0001",
			ConcertID:   "CC0001",
			ActionType:  "CREATE",
			Description: "สร้างรายการคอนเสิร์ต Riverside Sound Festival",
			CreatedAt:   time.Now().Add(-72 * time.Hour),
		})
		h.db.Create(&models.ModifiedHistory{
			HistoryID:   "MH0002",
			ConcertID:   "CC0001",
			ActionType:  "UPDATE",
			Description: "เพิ่มรายชื่อศิลปิน PUN และ YOUNGGU",
			CreatedAt:   time.Now().Add(-48 * time.Hour),
		})
		h.db.Create(&models.ModifiedHistory{
			HistoryID:   "MH0003",
			ConcertID:   "CC0001",
			ActionType:  "UPDATE",
			Description: "อัปเดตสถานะการติดต่อผู้สนับสนุนเป็นสำเร็จแล้ว",
			CreatedAt:   time.Now().Add(-24 * time.Hour),
		})
		h.db.Create(&models.ModifiedHistory{
			HistoryID:   "MH0004",
			ConcertID:   "CC0001",
			ActionType:  "UPDATE",
			Description: "แก้ไขสถานที่จัดงานเป็น ธันเดอร์โดม เมืองทองธานี",
			CreatedAt:   time.Now().Add(-2 * time.Hour),
		})
	}

	var taskCount int64
	h.db.Model(&models.Task{}).Count(&taskCount)
	if taskCount == 0 {
		h.db.Create(&models.Task{
			TaskID:           "TS0001",
			ConcertID:        "CC0001",
			TaskName:         "ประสานงานขอใบอนุญาตและสถานที่",
			ActualFinishDate: "2026-10-10",
			OwnerTask:        "นายสมศักดิ์ ขยันงาน",
			Department:       "ฝ่ายสถานที่",
			TaskStatus:       "รอดำเนินการ",
			MoreInfo:         "ติดต่อสำนักงานเขตและผู้ดูแลพื้นที่",
		})
		h.db.Create(&models.Task{
			TaskID:           "TS0002",
			ConcertID:        "CC0001",
			TaskName:         "จัดเตรียมระบบไฟและเครื่องเสียง",
			ActualFinishDate: "2026-10-12",
			OwnerTask:        "นางสาวดนตรี ไพเราะ",
			Department:       "ฝ่ายเทคนิค",
			TaskStatus:       "รอดำเนินการ",
			MoreInfo:         "เช็คระบบไมค์และลำโพงเวทีหลัก",
		})
		h.db.Create(&models.Task{
			TaskID:           "TS0003",
			ConcertID:        "CC0001",
			TaskName:         "ดูแลรับรองศิลปินและห้องพัก",
			ActualFinishDate: "2026-10-14",
			OwnerTask:        "นายวีระ สุดหล่อ",
			Department:       "ฝ่ายดูแลศิลปิน",
			TaskStatus:       "รอดำเนินการ",
			MoreInfo:         "จัดเตรียมอาหารและเครื่องดื่มตามคำขอ",
		})
	}

	var docCount int64
	h.db.Model(&models.ConcertDocument{}).Count(&docCount)
	if docCount == 0 {
		h.db.Create(&models.ConcertDocument{
			DocumentID:   "CD0001",
			ConcertID:    "CC0001",
			Category:     "เอกสารขอเข้าใช้สถานที่",
			DocumentName: "เอกสารขออนุญาตใช้พื้นที่ธันเดอร์โดม เมืองทองธานี.pdf",
			DocumentFile: []byte("sample pdf file"),
		})
		h.db.Create(&models.ConcertDocument{
			DocumentID:   "CD0002",
			ConcertID:    "CC0001",
			Category:     "สัญญาการจ้างศิลปิน",
			DocumentName: "สัญญาการจ้างและการแสดงศิลปิน PUN และ YOUNGGU.pdf",
			DocumentFile: []byte("sample pdf file"),
		})
		h.db.Create(&models.ConcertDocument{
			DocumentID:   "CD0003",
			ConcertID:    "CC0001",
			Category:     "สัญญาผู้สนับสนุน",
			DocumentName: "บันทึกข้อตกลงผู้สนับสนุนหลักเครื่องดื่มชูกำลัง.pdf",
			DocumentFile: []byte("sample pdf file"),
		})
		h.db.Create(&models.ConcertDocument{
			DocumentID:   "CD0004",
			ConcertID:    "CC0002",
			Category:     "เอกสารขอเข้าใช้สถานที่",
			DocumentName: "เอกสารขอเช่าพื้นที่ MCC Hall เดอะมอลล์บางกะปิ.pdf",
			DocumentFile: []byte("sample pdf file"),
		})
	}
}

type concertResponse struct {
	ConcertID   string   `json:"concert_id"`
	ConcertName string   `json:"concert_name"`
	StartDate   string   `json:"start_date"`
	EndDate     string   `json:"end_date"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	Location    string   `json:"location"`
	Status      string   `json:"status"`
	MoreInfo    string   `json:"more_info"`
	PosterName  string   `json:"poster_name"`
	PosterData  string   `json:"poster_data,omitempty"`
	Artists     []string `json:"artists"`
}

func (h *ConcertHandler) listConcerts(c *fiber.Ctx) error {
	var concerts []models.Concert
	if err := h.db.Order("created_at desc, concert_id asc").Find(&concerts).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	result := make([]concertResponse, 0, len(concerts))
	for _, concert := range concerts {
		var artists []string
		var ca []models.ConcertArtist
		h.db.Where("concert_id = ?", concert.ConcertID).Find(&ca)
		for _, item := range ca {
			artists = append(artists, item.ArtistID)
		}

		result = append(result, concertResponse{
			ConcertID:   concert.ConcertID,
			ConcertName: concert.ConcertName,
			StartDate:   dateOnly(concert.StartDate),
			EndDate:     dateOnly(concert.EndDate),
			StartTime:   clockOnly(concert.StartTime),
			EndTime:     clockOnly(concert.EndTime),
			Location:    concert.Location,
			Status:      concert.Status,
			MoreInfo:    concert.MoreInfo,
			Artists:     artists,
		})
	}

	return c.JSON(result)
}

func (h *ConcertHandler) getConcert(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	var artists []string
	var ca []models.ConcertArtist
	h.db.Where("concert_id = ?", concert.ConcertID).Find(&ca)
	for _, item := range ca {
		artists = append(artists, item.ArtistID)
	}

	var posterBase64 string
	if len(concert.Poster) > 0 {
		posterBase64 = base64.StdEncoding.EncodeToString(concert.Poster)
	} else if len(concert.ConcertPoster) > 0 {
		posterBase64 = base64.StdEncoding.EncodeToString(concert.ConcertPoster)
	}

	return c.JSON(concertResponse{
		ConcertID:   concert.ConcertID,
		ConcertName: concert.ConcertName,
		StartDate:   dateOnly(concert.StartDate),
		EndDate:     dateOnly(concert.EndDate),
		StartTime:   clockOnly(concert.StartTime),
		EndTime:     clockOnly(concert.EndTime),
		Location:    concert.Location,
		Status:      concert.Status,
		MoreInfo:    concert.MoreInfo,
		PosterData:  posterBase64,
		Artists:     artists,
	})
}

type createConcertRequest struct {
	ConcertName string   `json:"concert_name"`
	StartDate   string   `json:"start_date"`
	EndDate     string   `json:"end_date"`
	StartTime   string   `json:"start_time"`
	EndTime     string   `json:"end_time"`
	Location    string   `json:"location"`
	MoreInfo    string   `json:"more_info"`
	Artists     []string `json:"artists"`
	PosterData  string   `json:"poster_data"`
	PosterName  string   `json:"poster_name"`
}

func (h *ConcertHandler) createConcert(c *fiber.Ctx) error {
	var posterBytes []byte
	var req createConcertRequest

	// Check if multipart form
	if strings.Contains(c.Get("Content-Type"), "multipart/form-data") {
		req.ConcertName = c.FormValue("concert_name")
		req.StartDate = c.FormValue("start_date")
		req.EndDate = c.FormValue("end_date")
		req.StartTime = c.FormValue("start_time")
		req.EndTime = c.FormValue("end_time")
		req.Location = c.FormValue("location")
		req.MoreInfo = c.FormValue("more_info")
		artistsStr := c.FormValue("artists")
		if artistsStr != "" {
			req.Artists = strings.Split(artistsStr, ",")
		}

		file, err := c.FormFile("poster")
		if err == nil && file != nil {
			f, err := file.Open()
			if err == nil {
				defer f.Close()
				posterBytes, _ = io.ReadAll(f)
			}
		}
	} else {
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
		}
		if req.PosterData != "" {
			// Strip prefix if any
			data := req.PosterData
			if idx := strings.Index(data, ","); idx != -1 {
				data = data[idx+1:]
			}
			posterBytes, _ = base64.StdEncoding.DecodeString(data)
		}
	}

	if req.ConcertName == "" || req.StartDate == "" || req.EndDate == "" || req.Location == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"})
	}

	if posterBytes == nil {
		posterBytes = []byte{}
	}

	concert := models.Concert{
		ConcertName:   req.ConcertName,
		StartDate:     req.StartDate,
		EndDate:       req.EndDate,
		StartTime:     clockOnly(req.StartTime),
		EndTime:       clockOnly(req.EndTime),
		Location:      req.Location,
		Status:        "วางแผน",
		Poster:        posterBytes,
		ConcertPoster: posterBytes,
		MoreInfo:      req.MoreInfo,
	}

	if err := h.db.Create(&concert).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "บันทึกคอนเสิร์ตไม่สำเร็จ: " + err.Error()})
	}

	// Link artists
	for _, a := range req.Artists {
		name := strings.TrimSpace(a)
		if name != "" {
			h.db.Create(&models.ConcertArtist{
				ConcertID: concert.ConcertID,
				ArtistID:  name,
			})
		}
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   concert.ConcertID,
		ActionType:  "CREATE",
		Description: fmt.Sprintf("สร้างรายการคอนเสิร์ต %s", concert.ConcertName),
		CreatedAt:   time.Now(),
	})

	return c.Status(201).JSON(fiber.Map{
		"message":    "บันทึกข้อมูลสำเร็จ",
		"concert_id": concert.ConcertID,
	})
}

func (h *ConcertHandler) updateConcert(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	var req createConcertRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.StartDate != "" {
		concert.StartDate = req.StartDate
	}
	if req.EndDate != "" {
		concert.EndDate = req.EndDate
	}
	if req.StartTime != "" {
		concert.StartTime = clockOnly(req.StartTime)
	}
	if req.EndTime != "" {
		concert.EndTime = clockOnly(req.EndTime)
	}
	if req.Location != "" {
		concert.Location = req.Location
	}
	if req.MoreInfo != "" {
		concert.MoreInfo = req.MoreInfo
	}

	if err := h.db.Save(&concert).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "อัปเดตข้อมูลไม่สำเร็จ: " + err.Error()})
	}

	// Update artists if provided
	if req.Artists != nil {
		h.db.Where("concert_id = ?", concert.ConcertID).Delete(&models.ConcertArtist{})
		for _, a := range req.Artists {
			name := strings.TrimSpace(a)
			if name != "" {
				h.db.Create(&models.ConcertArtist{
					ConcertID: concert.ConcertID,
					ArtistID:  name,
				})
			}
		}
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   concert.ConcertID,
		ActionType:  "UPDATE",
		Description: fmt.Sprintf("แก้ไขข้อมูลคอนเสิร์ต %s (สถานที่: %s)", concert.ConcertName, concert.Location),
		CreatedAt:   time.Now(),
	})

	return c.JSON(fiber.Map{
		"message":    "อัพเดตข้อมูลสำเร็จ",
		"concert_id": concert.ConcertID,
	})
}

func (h *ConcertHandler) deleteConcert(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	concertName := concert.ConcertName
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var scheduleIDs []string
		if err := tx.Model(&models.PerformanceSchedule{}).Where("concert_id = ?", id).Pluck("schedule_id", &scheduleIDs).Error; err != nil {
			return err
		}
		if len(scheduleIDs) > 0 {
			if err := tx.Where("schedule_id IN ?", scheduleIDs).Delete(&models.PerformanceDetail{}).Error; err != nil {
				return err
			}
		}

		var seatIDs []string
		if err := tx.Model(&models.Seat{}).Where("concert_id = ?", id).Pluck("seat_id", &seatIDs).Error; err != nil {
			return err
		}
		if len(seatIDs) > 0 {
			var ticketIDs []string
			if err := tx.Model(&models.Ticket{}).Where("seat_id IN ?", seatIDs).Pluck("ticket_id", &ticketIDs).Error; err != nil {
				return err
			}
			if len(ticketIDs) > 0 {
				if err := tx.Where("ticket_id IN ?", ticketIDs).Delete(&models.GateCheckIn{}).Error; err != nil {
					return err
				}
			}
			if err := tx.Where("seat_id IN ?", seatIDs).Delete(&models.Ticket{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("concert_id = ?", id).Delete(&models.Seat{}).Error; err != nil {
			return err
		}

		var promotionIDs []string
		if err := tx.Model(&models.Promotion{}).Where("concert_id = ?", id).Pluck("promotion_id", &promotionIDs).Error; err != nil {
			return err
		}
		if len(promotionIDs) > 0 {
			for _, model := range []any{
				&models.PromotionApproval{}, &models.PromoCondition{}, &models.DiscountInfo{},
				&models.Quota{},
			} {
				if err := tx.Where("promotion_id IN ?", promotionIDs).Delete(model).Error; err != nil {
					return err
				}
			}
			if err := tx.Where("promotion_id IN ?", promotionIDs).Delete(&models.Promotion{}).Error; err != nil {
				return err
			}
		}

		deleteByConcert := func(model any) error {
			return tx.Where("concert_id = ?", id).Delete(model).Error
		}
		for _, model := range []any{
			&models.PerformanceSchedule{}, &models.ArtistRequirement{},
			&models.ConcertArtist{}, &models.ConcertDocument{}, &models.Task{},
			&models.WorkPlan{}, &models.SponsorshipRequest{}, &models.SummaryReport{},
			&models.Publication{}, &models.LayoutObject{}, &models.Zone{},
		} {
			if err := deleteByConcert(model); err != nil {
				return err
			}
		}
		if err := tx.Delete(&concert).Error; err != nil {
			return err
		}
		return tx.Create(&models.ModifiedHistory{
			ConcertID: id, ActionType: "DELETE",
			Description: fmt.Sprintf("ลบคอนเสิร์ต: %s (รหัส %s)", concertName, id),
			CreatedAt:   time.Now(),
		}).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "ลบคอนเสิร์ตไม่สำเร็จ: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":    "ลบคอนเสิร์ตสำเร็จ",
		"concert_id": id,
	})
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (h *ConcertHandler) updateConcertStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	var req updateStatusRequest
	if err := c.BodyParser(&req); err != nil || req.Status == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุสถานะคอนเสิร์ต"})
	}

	concert.Status = req.Status
	if err := h.db.Save(&concert).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "อัปเดตสถานะไม่สำเร็จ: " + err.Error()})
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   concert.ConcertID,
		ActionType:  "UPDATE_STATUS",
		Description: fmt.Sprintf("เปลี่ยนสถานะคอนเสิร์ต %s เป็น \"%s\"", concert.ConcertName, concert.Status),
		CreatedAt:   time.Now(),
	})

	return c.JSON(fiber.Map{
		"message": "บันทึกสถานะสำเร็จ",
		"status":  concert.Status,
	})
}

type createTaskRequest struct {
	TaskName         string `json:"task_name"`
	ActualFinishDate string `json:"actual_finish_date"`
	OwnerTask        string `json:"owner_task"`
	Department       string `json:"department"`
	MoreInfo         string `json:"more_info"`
}

func (h *ConcertHandler) createTask(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	var req createTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TaskName == "" || req.OwnerTask == "" || req.Department == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณากรอกข้อมูลภารกิจย่อยและผู้รับผิดชอบให้ครบถ้วน"})
	}

	var finishDate string
	if req.ActualFinishDate != "" {
		finishDate = req.ActualFinishDate
	} else {
		finishDate = time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	}

	task := models.Task{
		ConcertID:        concert.ConcertID,
		TaskName:         req.TaskName,
		ActualFinishDate: finishDate,
		OwnerTask:        req.OwnerTask,
		Department:       req.Department,
		TaskStatus:       "รอดำเนินการ",
		MoreInfo:         req.MoreInfo,
	}

	if err := h.db.Create(&task).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "บันทึกผู้รับผิดชอบไม่สำเร็จ: " + err.Error()})
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   concert.ConcertID,
		ActionType:  "CREATE_TASK",
		Description: fmt.Sprintf("เพิ่มภารกิจย่อย: %s (ผู้รับผิดชอบ: %s, ฝ่าย: %s)", task.TaskName, task.OwnerTask, task.Department),
		CreatedAt:   time.Now(),
	})

	return c.Status(201).JSON(fiber.Map{
		"message": "บันทึกผู้รับผิดชอบสำเร็จ",
		"task_id": task.TaskID,
	})
}

func (h *ConcertHandler) listTasks(c *fiber.Ctx) error {
	id := c.Params("id")
	var tasks []models.Task
	if err := h.db.Where("concert_id = ?", id).Order("task_id asc").Find(&tasks).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tasks)
}

type updateTaskStatusRequest struct {
	TaskStatus string `json:"task_status"`
}

func (h *ConcertHandler) updateTaskStatus(c *fiber.Ctx) error {
	taskId := c.Params("taskId")
	var task models.Task
	if err := h.db.First(&task, "task_id = ?", taskId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
	}

	var req updateTaskStatusRequest
	if err := c.BodyParser(&req); err != nil || req.TaskStatus == "" {
		req.TaskStatus = "เสร็จสิ้น"
	}

	task.TaskStatus = req.TaskStatus
	if err := h.db.Save(&task).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "อัปเดตสถานะงานไม่สำเร็จ: " + err.Error()})
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   task.ConcertID,
		ActionType:  "UPDATE_TASK",
		Description: fmt.Sprintf("อัปเดตสถานะภารกิจย่อย %s เป็น '%s'", task.TaskName, task.TaskStatus),
		CreatedAt:   time.Now(),
	})

	return c.JSON(fiber.Map{
		"message":     "อัปเดตสถานะงานสำเร็จ",
		"task_id":     task.TaskID,
		"task_status": task.TaskStatus,
	})
}

func (h *ConcertHandler) createDocument(c *fiber.Ctx) error {
	id := c.Params("id")
	var concert models.Concert
	if err := h.db.First(&concert, "concert_id = ?", id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Concert not found"})
	}

	category := c.FormValue("category")
	documentName := c.FormValue("document_name")

	var docBytes []byte
	file, err := c.FormFile("document_file")
	if err == nil && file != nil {
		f, err := file.Open()
		if err == nil {
			defer f.Close()
			docBytes, _ = io.ReadAll(f)
		}
		ext := filepath.Ext(file.Filename)
		if ext != "" && !strings.HasSuffix(strings.ToLower(documentName), strings.ToLower(ext)) {
			documentName = documentName + ext
		}
	}

	if category == "" || documentName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "กรุณาระบุหมวดหมู่และหัวข้อเอกสาร"})
	}

	doc := models.ConcertDocument{
		ConcertID:    concert.ConcertID,
		Category:     category,
		DocumentName: documentName,
		DocumentFile: docBytes,
	}

	if err := h.db.Create(&doc).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "บันทึกเอกสารไม่สำเร็จ: " + err.Error()})
	}

	// Record history
	h.db.Create(&models.ModifiedHistory{
		ConcertID:   concert.ConcertID,
		ActionType:  "UPLOAD_DOCUMENT",
		Description: fmt.Sprintf("แนบเอกสาร: %s (หมวดหมู่: %s)", doc.DocumentName, doc.Category),
		CreatedAt:   time.Now(),
	})

	return c.Status(201).JSON(fiber.Map{
		"message":     "บันทึกเอกสารสำเร็จ",
		"document_id": doc.DocumentID,
	})
}

type documentResponse struct {
	DocumentID   string `json:"document_id"`
	Category     string `json:"category"`
	DocumentName string `json:"document_name"`
	ConcertID    string `json:"concert_id"`
	HasFile      bool   `json:"has_file"`
	FileURL      string `json:"file_url"`
}

func (h *ConcertHandler) listDocuments(c *fiber.Ctx) error {
	id := c.Params("id")
	var docs []models.ConcertDocument
	if err := h.db.Where("concert_id = ?", id).Order("document_id asc").Find(&docs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	result := make([]documentResponse, 0, len(docs))
	for _, doc := range docs {
		result = append(result, documentResponse{
			DocumentID:   doc.DocumentID,
			Category:     doc.Category,
			DocumentName: doc.DocumentName,
			ConcertID:    doc.ConcertID,
			HasFile:      len(doc.DocumentFile) > 0,
			FileURL:      fmt.Sprintf("http://localhost:8080/api/documents/%s/file", doc.DocumentID),
		})
	}
	return c.JSON(result)
}

func (h *ConcertHandler) getDocumentFile(c *fiber.Ctx) error {
	docId := c.Params("docId")
	var doc models.ConcertDocument
	if err := h.db.First(&doc, "document_id = ?", docId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
	}

	if len(doc.DocumentFile) == 0 {
		// Return text representation
		c.Set("Content-Type", "text/plain; charset=utf-8")
		return c.SendString(fmt.Sprintf("เอกสาร: %s\nหมวดหมู่: %s\nรหัสเอกสาร: %s", doc.DocumentName, doc.Category, doc.DocumentID))
	}

	filename := doc.DocumentName
	lowerName := strings.ToLower(filename)
	contentType := "application/octet-stream"

	// 1. Detect by magic bytes / file signature
	if bytes.HasPrefix(doc.DocumentFile, []byte("%PDF-")) {
		contentType = "application/pdf"
		if !strings.HasSuffix(lowerName, ".pdf") {
			filename += ".pdf"
		}
	} else if bytes.HasPrefix(doc.DocumentFile, []byte{0x50, 0x4B, 0x03, 0x04}) { // ZIP / Office OpenXML
		if bytes.Contains(doc.DocumentFile, []byte("word/")) || strings.HasSuffix(lowerName, ".docx") {
			contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
			if !strings.HasSuffix(lowerName, ".docx") {
				filename += ".docx"
			}
		} else if bytes.Contains(doc.DocumentFile, []byte("xl/")) || strings.HasSuffix(lowerName, ".xlsx") {
			contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			if !strings.HasSuffix(lowerName, ".xlsx") {
				filename += ".xlsx"
			}
		} else {
			contentType = "application/zip"
			if !strings.HasSuffix(lowerName, ".zip") {
				filename += ".zip"
			}
		}
	} else if strings.HasSuffix(lowerName, ".pdf") {
		contentType = "application/pdf"
	} else if strings.HasSuffix(lowerName, ".docx") {
		contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	} else if strings.HasSuffix(lowerName, ".xlsx") {
		contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	} else if strings.HasSuffix(lowerName, ".csv") || strings.HasSuffix(lowerName, ".txt") {
		contentType = "text/csv; charset=utf-8"
	} else if bytes.HasPrefix(doc.DocumentFile, []byte{0x89, 0x50, 0x4E, 0x47}) || strings.HasSuffix(lowerName, ".png") {
		contentType = "image/png"
	} else if bytes.HasPrefix(doc.DocumentFile, []byte{0xFF, 0xD8, 0xFF}) || strings.HasSuffix(lowerName, ".jpg") || strings.HasSuffix(lowerName, ".jpeg") {
		contentType = "image/jpeg"
	} else {
		// Default to PDF or CSV based on name
		contentType = "application/pdf"
	}

	encodedFilename := url.PathEscape(filename)
	c.Set("Content-Type", contentType)
	c.Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"; filename*=UTF-8''%s`, filename, encodedFilename))
	return c.Send(doc.DocumentFile)
}

func (h *ConcertHandler) deleteDocument(c *fiber.Ctx) error {
	docId := c.Params("docId")
	var doc models.ConcertDocument
	if err := h.db.First(&doc, "document_id = ?", docId).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Document not found"})
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&doc).Error; err != nil {
			return err
		}
		return tx.Create(&models.ModifiedHistory{
			ConcertID: doc.ConcertID, ActionType: "DELETE_DOCUMENT",
			Description: fmt.Sprintf("ลบเอกสาร: %s (หมวดหมู่: %s)", doc.DocumentName, doc.Category),
			CreatedAt:   time.Now(),
		}).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "ลบเอกสารไม่สำเร็จ: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":     "ลบเอกสารสำเร็จ",
		"document_id": docId,
	})
}

type historyItemResponse struct {
	ID          string    `json:"id"`
	Date        string    `json:"date"`
	Time        string    `json:"time"`
	Detail      string    `json:"detail"`
	Author      string    `json:"author"`
	ConcertID   string    `json:"concert_id"`
	ConcertName string    `json:"concert_name"`
	CreatedAt   time.Time `json:"created_at"`
}

func (h *ConcertHandler) listHistory(c *fiber.Ctx) error {
	concertID := c.Query("concert_id")
	dateFilter := c.Query("date")

	query := h.db.Model(&models.ModifiedHistory{}).Order("created_at desc")
	if concertID != "" {
		query = query.Where("concert_id = ?", concertID)
	}

	var list []models.ModifiedHistory
	if err := query.Find(&list).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Get concert names mapping
	var concerts []models.Concert
	h.db.Find(&concerts)
	cNameMap := make(map[string]string)
	for _, item := range concerts {
		cNameMap[item.ConcertID] = item.ConcertName
	}

	result := make([]historyItemResponse, 0, len(list))
	authors := []string{"นภัส", "พรลภัส", "พิเชษฐ์", "อุษณิษา"}

	for i, item := range list {
		formattedDate := item.CreatedAt.Format("02/01/2006")
		formattedTime := item.CreatedAt.Format("15:04 น.")

		// Apply date filter if specified (e.g. 2006-01-02 or 02/01/2006)
		if dateFilter != "" {
			if !strings.Contains(item.CreatedAt.Format("2006-01-02"), dateFilter) &&
				!strings.Contains(formattedDate, dateFilter) {
				continue
			}
		}

		cName := cNameMap[item.ConcertID]
		if cName == "" {
			cName = item.ConcertID
		}

		author := authors[i%len(authors)]

		result = append(result, historyItemResponse{
			ID:          item.HistoryID,
			Date:        formattedDate,
			Time:        formattedTime,
			Detail:      item.Description,
			Author:      author,
			ConcertID:   item.ConcertID,
			ConcertName: cName,
			CreatedAt:   item.CreatedAt,
		})
	}

	return c.JSON(result)
}

func (h *ConcertHandler) listHistoryByConcert(c *fiber.Ctx) error {
	id := c.Params("id")
	c.Context().URI().QueryArgs().Set("concert_id", id)
	return h.listHistory(c)
}
