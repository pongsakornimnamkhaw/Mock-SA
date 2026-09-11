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
		{"finance cannot open concerts", "staff", "ฝ่ายการเงิน", Concerts, nil, None},
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
