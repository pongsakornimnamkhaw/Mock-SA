package handlers

import (
	"sort"
	"strings"
	"time"

	"backend/internal/access"
	"backend/internal/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type dashboardSummaryDTO struct {
	TotalConcerts     int     `json:"total_concerts"`
	ConcertsThisMonth int     `json:"concerts_this_month"`
	TotalBudget       float64 `json:"total_budget"`
	IncompleteTasks   int     `json:"incomplete_tasks"`
	ResponsiblePeople int     `json:"responsible_people"`
}

type dashboardConcertDTO struct {
	ConcertID   string    `json:"concert_id"`
	ConcertName string    `json:"concert_name"`
	StartDate   string    `json:"start_date"`
	EndDate     string    `json:"end_date"`
	StartTime   string    `json:"start_time"`
	EndTime     string    `json:"end_time"`
	Location    string    `json:"location"`
	Status      string    `json:"status"`
	PosterURL   string    `json:"poster_url"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type dashboardTaskDTO struct {
	TaskID      string `json:"task_id"`
	ConcertID   string `json:"concert_id"`
	ConcertName string `json:"concert_name"`
	TaskName    string `json:"task_name"`
	Owner       string `json:"owner"`
	Department  string `json:"department"`
	Status      string `json:"status"`
	FinishDate  string `json:"finish_date"`
}

type dashboardHistoryDTO struct {
	HistoryID   string    `json:"history_id"`
	ConcertID   string    `json:"concert_id"`
	ConcertName string    `json:"concert_name"`
	ActionType  string    `json:"action_type"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type dashboardDTO struct {
	Summary          dashboardSummaryDTO   `json:"summary"`
	FeaturedConcerts []dashboardConcertDTO `json:"featured_concerts"`
	ConcertStatuses  []dashboardConcertDTO `json:"concert_statuses"`
	Responsibilities []dashboardTaskDTO    `json:"responsibilities"`
	RecentUpdates    []dashboardHistoryDTO `json:"recent_updates"`
}

func RegisterDashboardRoutes(app *fiber.App, db *gorm.DB) {
	handler := func(c *fiber.Ctx) error {
		var concerts []models.Concert
		var plans []models.WorkPlan
		var tasks []models.Task
		var histories []models.ModifiedHistory
		if err := db.Order("updated_at DESC").Find(&concerts).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "โหลดข้อมูล Dashboard ไม่สำเร็จ"})
		}
		if err := db.Find(&plans).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "โหลดงบประมาณไม่สำเร็จ"})
		}
		if err := db.Find(&tasks).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "โหลดภารกิจไม่สำเร็จ"})
		}
		if err := db.Order("created_at DESC").Limit(10).Find(&histories).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "โหลดประวัติไม่สำเร็จ"})
		}
		return c.JSON(buildDashboardData(concerts, plans, tasks, histories, time.Now()))
	}
	app.Get("/api/dashboard", requireEmployeeModule(db, access.Dashboard, access.View), handler)
}

func dashboardTaskComplete(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "เสร็จสิ้น", "completed", "complete", "done":
		return true
	default:
		return false
	}
}

func buildDashboardData(concerts []models.Concert, plans []models.WorkPlan, tasks []models.Task, histories []models.ModifiedHistory, now time.Time) dashboardDTO {
	result := dashboardDTO{
		FeaturedConcerts: []dashboardConcertDTO{}, ConcertStatuses: []dashboardConcertDTO{},
		Responsibilities: []dashboardTaskDTO{}, RecentUpdates: []dashboardHistoryDTO{},
	}
	result.Summary.TotalConcerts = len(concerts)
	monthPrefix := now.Format("2006-01")
	concertNames := make(map[string]string, len(concerts))
	sort.SliceStable(concerts, func(i, j int) bool { return concerts[i].UpdatedAt.After(concerts[j].UpdatedAt) })
	for _, concert := range concerts {
		concertNames[concert.ConcertID] = concert.ConcertName
		if strings.HasPrefix(concert.StartDate, monthPrefix) {
			result.Summary.ConcertsThisMonth++
		}
		view := dashboardConcertDTO{
			ConcertID: concert.ConcertID, ConcertName: concert.ConcertName, StartDate: concert.StartDate,
			EndDate: concert.EndDate, StartTime: concert.StartTime, EndTime: concert.EndTime,
			Location: concert.Location, Status: concert.Status, PosterURL: concertPosterURL(concert), UpdatedAt: concert.UpdatedAt,
		}
		if len(result.ConcertStatuses) < 5 {
			result.ConcertStatuses = append(result.ConcertStatuses, view)
		}
		if view.PosterURL != "" && len(result.FeaturedConcerts) < 3 {
			result.FeaturedConcerts = append(result.FeaturedConcerts, view)
		}
	}
	for _, plan := range plans {
		result.Summary.TotalBudget += plan.Budget
	}
	owners := map[string]struct{}{}
	for _, task := range tasks {
		if dashboardTaskComplete(task.TaskStatus) {
			continue
		}
		result.Summary.IncompleteTasks++
		owner := strings.TrimSpace(task.OwnerTask)
		if owner != "" {
			owners[owner] = struct{}{}
		}
		if len(result.Responsibilities) < 6 {
			result.Responsibilities = append(result.Responsibilities, dashboardTaskDTO{
				TaskID: task.TaskID, ConcertID: task.ConcertID, ConcertName: concertNames[task.ConcertID],
				TaskName: task.TaskName, Owner: owner, Department: task.Department,
				Status: task.TaskStatus, FinishDate: task.ActualFinishDate,
			})
		}
	}
	result.Summary.ResponsiblePeople = len(owners)
	for _, history := range histories {
		result.RecentUpdates = append(result.RecentUpdates, dashboardHistoryDTO{
			HistoryID: history.HistoryID, ConcertID: history.ConcertID, ConcertName: concertNames[history.ConcertID],
			ActionType: history.ActionType, Description: history.Description, CreatedAt: history.CreatedAt,
		})
	}
	return result
}
