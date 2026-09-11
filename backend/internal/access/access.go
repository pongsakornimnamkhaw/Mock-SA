package access

import "strings"

type Level string

const (
	None Level = "none"
	View Level = "view"
	Edit Level = "edit"
)

func (l Level) Valid() bool { return l == None || l == View || l == Edit }

func (l Level) Allows(required Level) bool {
	rank := map[Level]int{None: 0, View: 1, Edit: 2}
	return l.Valid() && required.Valid() && rank[l] >= rank[required]
}

type Module string

type Feature string

const (
	ConcertDashboard        Feature = "concert.dashboard"
	ConcertCreate           Feature = "concert.create"
	ConcertEdit             Feature = "concert.edit"
	ConcertAssignment       Feature = "concert.assignment"
	ConcertStatus           Feature = "concert.status"
	ConcertDocuments        Feature = "concert.documents"
	ConcertHistory          Feature = "concert.history"
	ConcertSearch           Feature = "concert.search"
	ArtistDashboard         Feature = "artist.dashboard"
	ArtistSearch            Feature = "artist.search"
	ArtistManage            Feature = "artist.manage"
	ArtistInvitation        Feature = "artist.invitation"
	ArtistScheduleCreate    Feature = "artist.schedule.create"
	ArtistScheduleView      Feature = "artist.schedule.view"
	ArtistPerformanceManage Feature = "artist.performance.manage"
	ArtistHistory           Feature = "artist.history"
	ReportView              Feature = "report.view"
	ReportManage            Feature = "report.manage"
)

const (
	Dashboard          Module = "dashboard"
	Concerts           Module = "concerts"
	Artists            Module = "artists"
	Venues             Module = "venues"
	Registration       Module = "registration"
	ConcertCatalog     Module = "concert_catalog"
	Promotions         Module = "promotions"
	PromotionApprovals Module = "promotion_approvals"
	Sales              Module = "sales"
	Audit              Module = "audit"
	EmployeeManagement Module = "employees"
	Reports            Module = "reports"
)

var Modules = []Module{
	Dashboard, Concerts, Artists, Venues, Registration, ConcertCatalog,
	Promotions, PromotionApprovals, Sales, Audit, EmployeeManagement, Reports,
}

func (m Module) Valid() bool {
	for _, candidate := range Modules {
		if m == candidate {
			return true
		}
	}
	return false
}

// Resolve returns navigation-level access. Explicit employee settings take
// precedence over role and department defaults, including explicit denials.
func Resolve(role, department string, module Module, overrides map[Module]Level) Level {
	if !module.Valid() {
		return None
	}
	role = strings.ToLower(strings.TrimSpace(role))
	department = strings.ToLower(strings.TrimSpace(department))
	// Dashboard is always visible. Audit and employee administration are
	// reserved for administrators and cannot be opened by an override.
	if module == Dashboard {
		return View
	}
	if module == Audit || module == EmployeeManagement {
		if role == "admin" || role == "administrator" {
			return Edit
		}
		return None
	}
	if role == "admin" || role == "administrator" || role == "ผู้ดูแลระบบ" {
		return Edit
	}
	if level, exists := overrides[module]; exists {
		if level.Valid() {
			return level
		}
		return None
	}
	if role == "view_only" {
		return None
	}

	switch module {
	case Concerts:
		if ResolveFeature(role, department, ConcertCreate) == Edit {
			return Edit
		}
		return ResolveFeature(role, department, ConcertDashboard)
	case Artists:
		return ResolveFeature(role, department, ArtistSearch)
	case Venues:
		if strings.Contains(department, "สถานที่") {
			return Edit
		}
	case Registration:
		if role == "event_staff" || role == "สตาฟงาน" || strings.Contains(department, "สตาฟ") {
			return Edit
		}
	case ConcertCatalog, Promotions:
		if strings.Contains(department, "การตลาด") || department == "marketing" {
			return Edit
		}
	case PromotionApprovals:
		if role == "approver" || role == "ผู้มีอำนาจอนุมัติ" {
			return Edit
		}
		if strings.Contains(department, "การตลาด") || department == "marketing" {
			return View
		}
	case Sales:
		// Sales mutation access is deliberately explicit-only.
	case Reports:
		return ResolveFeature(role, department, ReportView)
	}
	return None
}

func ResolveAll(role, department string, overrides map[Module]Level) map[Module]Level {
	result := make(map[Module]Level, len(Modules))
	for _, module := range Modules {
		result[module] = Resolve(role, department, module, overrides)
	}
	return result
}

func operationalRole(role, department string) string {
	role = strings.ToLower(strings.TrimSpace(role))
	department = strings.ToLower(strings.TrimSpace(department))
	if role == "admin" || role == "administrator" || role == "ผู้ดูแลระบบ" {
		return "admin"
	}
	if role != "" && role != "staff" && role != "edit" && role != "view_only" {
		return role
	}
	switch {
	case strings.Contains(department, "โปรดักชั่น"):
		return "production_staff"
	case strings.Contains(department, "สถานที่"):
		return "venue_staff"
	case strings.Contains(department, "ขาย"):
		return "sales"
	case strings.Contains(department, "การตลาด"):
		return "marketing"
	case strings.Contains(department, "การเงิน"):
		return "finance"
	case strings.Contains(department, "เทคนิค"):
		return "technical_staff"
	case strings.Contains(department, "ผู้บริหาร"):
		return "executive"
	default:
		return role
	}
}

func oneOf(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if value == candidate {
			return true
		}
	}
	return false
}

func ResolveFeature(role, department string, feature Feature) Level {
	actor := operationalRole(role, department)
	if actor == "admin" {
		return Edit
	}
	concertActor := oneOf(actor, "organizer", "co_organizer", "production_staff", "venue_staff", "sales", "marketing", "finance", "executive")
	artistActor := oneOf(actor, "organizer", "co_organizer", "production_staff", "technical_staff", "artist", "artist_manager", "executive")
	switch feature {
	case ConcertDashboard, ConcertSearch, ConcertHistory:
		if concertActor {
			return View
		}
	case ConcertAssignment, ConcertDocuments:
		if actor == "organizer" {
			return Edit
		}
		if concertActor {
			return View
		}
	case ConcertCreate, ConcertEdit, ConcertStatus:
		if actor == "organizer" {
			return Edit
		}
	case ArtistDashboard, ArtistScheduleView, ArtistHistory:
		if artistActor {
			return View
		}
	case ArtistSearch:
		if actor == "organizer" {
			return Edit
		}
		if artistActor {
			return View
		}
	case ArtistManage, ArtistPerformanceManage:
		if actor == "artist_manager" {
			return Edit
		}
	case ArtistInvitation:
		if actor == "organizer" {
			return Edit
		}
		if actor == "artist" || actor == "artist_manager" {
			return View
		}
	case ArtistScheduleCreate:
		if actor == "organizer" {
			return Edit
		}
	case ReportView:
		if actor != "" {
			return View
		}
	case ReportManage:
		if actor == "organizer" {
			return Edit
		}
	}
	return None
}
