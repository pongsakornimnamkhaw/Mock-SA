package handlers

import (
	"testing"
	"time"

	"backend/internal/models"
)

func TestDashboardDataUsesAllConcertsForStatsAndOnlyPosterConcertsForFeatured(t *testing.T) {
	now := time.Date(2026, 9, 11, 12, 0, 0, 0, time.UTC)
	concerts := []models.Concert{
		{ConcertID: "CC1", ConcertName: "Newest", StartDate: "2026-09-20", Poster: []byte("image"), BaseModel: models.BaseModel{UpdatedAt: now}},
		{ConcertID: "CC2", ConcertName: "No poster", StartDate: "2026-09-21", BaseModel: models.BaseModel{UpdatedAt: now.Add(-time.Hour)}},
		{ConcertID: "CC3", ConcertName: "Older", StartDate: "2026-10-01", ConcertPoster: []byte("image"), BaseModel: models.BaseModel{UpdatedAt: now.Add(-2 * time.Hour)}},
	}
	tasks := []models.Task{
		{TaskID: "T1", OwnerTask: "Alice", TaskStatus: "รอดำเนินการ"},
		{TaskID: "T2", OwnerTask: "Alice", TaskStatus: "เสร็จสิ้น"},
		{TaskID: "T3", OwnerTask: "Bob", TaskStatus: "pending"},
	}
	view := buildDashboardData(concerts, nil, tasks, nil, now)
	if view.Summary.TotalConcerts != 3 || view.Summary.ConcertsThisMonth != 2 {
		t.Fatalf("summary = %+v", view.Summary)
	}
	if view.Summary.IncompleteTasks != 2 || view.Summary.ResponsiblePeople != 2 {
		t.Fatalf("task summary = %+v", view.Summary)
	}
	if len(view.FeaturedConcerts) != 2 || view.FeaturedConcerts[0].ConcertID != "CC1" || view.FeaturedConcerts[1].ConcertID != "CC3" {
		t.Fatalf("featured = %+v", view.FeaturedConcerts)
	}
}

func TestDashboardTaskCompletionRecognizesSupportedCompletedStatuses(t *testing.T) {
	for _, status := range []string{"เสร็จสิ้น", "completed", "DONE", " complete "} {
		if !dashboardTaskComplete(status) {
			t.Fatalf("dashboardTaskComplete(%q) = false", status)
		}
	}
	if dashboardTaskComplete("รอดำเนินการ") {
		t.Fatal("pending task reported complete")
	}
}
