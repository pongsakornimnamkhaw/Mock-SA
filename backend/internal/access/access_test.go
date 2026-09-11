package access

import "testing"

func TestResolveDefaultsAndOverrides(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		department string
		module     Module
		overrides  map[Module]Level
		want       Level
	}{
		{"dashboard for staff", "staff", "สตาฟงาน", Dashboard, nil, View},
		{"admin edits everything", "admin", "", EmployeeManagement, nil, Edit},
		{"marketing edits promotions", "staff", "ฝ่ายการตลาด", Promotions, nil, Edit},
		{"unrelated view-only account is locked", "view_only", "ฝ่ายการเงิน", Promotions, nil, None},
		{"finance can view reports", "staff", "ฝ่ายการเงิน", Reports, nil, View},
		{"finance can open concert views", "staff", "ฝ่ายการเงิน", Concerts, nil, View},
		{"marketing can view approvals", "staff", "ฝ่ายการตลาด", PromotionApprovals, nil, View},
		{"venue department edits seats", "staff", "ฝ่ายสถานที่", Venues, nil, Edit},
		{"event staff edits registration", "staff", "สตาฟงาน", Registration, nil, Edit},
		{"ordinary staff cannot view audit", "staff", "ฝ่ายการตลาด", Audit, nil, None},
		{"staff cannot override audit", "staff", "", Audit, map[Module]Level{Audit: Edit}, None},
		{"staff cannot override employee management", "staff", "", EmployeeManagement, map[Module]Level{EmployeeManagement: Edit}, None},
		{"dashboard denial is ignored", "staff", "", Dashboard, map[Module]Level{Dashboard: None}, View},
		{"explicit grant adds access", "staff", "ฝ่ายบุคคล", Sales, map[Module]Level{Sales: Edit}, Edit},
		{"explicit denial removes default", "staff", "ฝ่ายการตลาด", Promotions, map[Module]Level{Promotions: None}, None},
		{"unknown module fails closed", "staff", "ฝ่ายการตลาด", Module("unknown"), nil, None},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := Resolve(tc.role, tc.department, tc.module, tc.overrides); got != tc.want {
				t.Fatalf("Resolve()=%q want %q", got, tc.want)
			}
		})
	}
}

func TestValidRejectsUnknownValues(t *testing.T) {
	if Module("unknown").Valid() {
		t.Fatal("unknown module accepted")
	}
	if Level("owner").Valid() {
		t.Fatal("unknown level accepted")
	}
}

func TestResolveFeaturePermissions(t *testing.T) {
	tests := []struct {
		name, role, department string
		feature                Feature
		want                   Level
	}{
		{"organizer creates concert", "organizer", "", ConcertCreate, Edit},
		{"finance cannot create concert", "finance", "", ConcertCreate, None},
		{"finance views concert assignment", "finance", "", ConcertAssignment, View},
		{"legacy marketing views documents", "staff", "ฝ่ายการตลาด", ConcertDocuments, View},
		{"artist manager edits artists", "artist_manager", "", ArtistManage, Edit},
		{"organizer cannot edit artist profile", "organizer", "", ArtistManage, None},
		{"organizer edits artist search result", "organizer", "", ArtistSearch, Edit},
		{"artist views invitations", "artist", "", ArtistInvitation, View},
		{"production cannot view invitations", "production_staff", "", ArtistInvitation, None},
		{"production views shared schedule", "production_staff", "", ArtistScheduleView, View},
		{"manager edits performance", "artist_manager", "", ArtistPerformanceManage, Edit},
		{"finance views reports", "finance", "", ReportView, View},
		{"finance cannot confirm reports", "finance", "", ReportManage, None},
		{"organizer confirms reports", "organizer", "", ReportManage, Edit},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := ResolveFeature(tc.role, tc.department, tc.feature); got != tc.want {
				t.Fatalf("ResolveFeature()=%q want %q", got, tc.want)
			}
		})
	}
}
