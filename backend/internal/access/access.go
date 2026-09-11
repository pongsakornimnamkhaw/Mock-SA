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
		if role == "organizer" || role == "co_organizer" || role == "ผู้จัดงาน" || role == "ผู้จัดงานร่วม" {
			return Edit
		}
	case Artists:
		if role == "organizer" || role == "ผู้จัดงาน" {
			return Edit
		}
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
		if strings.Contains(department, "การเงิน") || department == "finance" {
			return View
		}
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
