package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"net"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"backend/internal/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestManagementEmployeeValidation(t *testing.T) {
	valid := employeeDTO{FirstName: "ทดสอบ", LastName: "ระบบ", EmployeeCode: "T-01", Email: "test@example.com", Phone: "0812345678", Permission: "view_only"}
	cases := []struct {
		name   string
		change func(*employeeDTO)
	}{
		{"missing name", func(e *employeeDTO) { e.FirstName = " " }},
		{"bad email", func(e *employeeDTO) { e.Email = "not-an-email" }},
		{"bad phone", func(e *employeeDTO) { e.Phone = "abcd" }},
		{"invalid permission", func(e *employeeDTO) { e.Permission = "owner" }},
		{"missing scope", func(e *employeeDTO) { e.Permission = "edit" }},
		{"long code", func(e *employeeDTO) { e.EmployeeCode = strings.Repeat("ก", 51) }},
		{"invalid personnel type", func(e *employeeDTO) { e.PersonnelType = "contractor" }},
		{"invalid job role", func(e *employeeDTO) { e.JobRole = "owner" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := valid
			tc.change(&e)
			if validateEmployee(&e) == nil {
				t.Fatal("expected validation error")
			}
		})
	}
	valid.Email = " Test@Example.com "
	valid.PersonnelType = ""
	if err := validateEmployee(&valid); err != nil {
		t.Fatal(err)
	}
	if valid.Email != "test@example.com" {
		t.Fatal("email not normalized")
	}
	if valid.PersonnelType != models.PersonnelTypeInternal {
		t.Fatalf("personnel type = %q; want %q", valid.PersonnelType, models.PersonnelTypeInternal)
	}
	valid.PersonnelType = models.PersonnelTypeExternal
	valid.JobRole = "organizer"
	if err := validateEmployee(&valid); err != nil {
		t.Fatal(err)
	}
	if valid.PersonnelType != models.PersonnelTypeExternal {
		t.Fatalf("personnel type = %q; want %q", valid.PersonnelType, models.PersonnelTypeExternal)
	}
}

func TestEmployeeViewIncludesModulesAfterAccountPermission(t *testing.T) {
	user := models.User{Role: "edit", Permissions: []models.Permission{
		{Position: employeePermissionPosition, PermissionName: "edit", Scope: ""},
		{Position: employeeModulePermissionPrefix + "sales", PermissionName: "edit", Scope: "global"},
		{Position: employeeModulePermissionPrefix + "promotions", PermissionName: "view", Scope: "global"},
	}}
	view := employeeView(user)
	if len(view.ModulePermissions) != 2 {
		t.Fatalf("module permissions omitted after account row: %#v", view.ModulePermissions)
	}
}

func TestManagementEmployeeModulePermissionValidation(t *testing.T) {
	valid := employeeDTO{
		FirstName: "Test", LastName: "Employee", EmployeeCode: "T-02",
		Email: "modules@example.com", Phone: "0812345678", Permission: "edit",
		ModulePermissions: []modulePermissionDTO{
			{Module: "promotions", Level: "edit"},
			{Module: "promotion_approvals", Level: "view"},
		},
	}
	if err := validateEmployee(&valid); err != nil {
		t.Fatalf("valid module permissions rejected: %v", err)
	}

	for _, permissions := range [][]modulePermissionDTO{
		{{Module: "unknown", Level: "edit"}},
		{{Module: "promotions", Level: "owner"}},
		{{Module: "promotions", Level: "view"}, {Module: "promotions", Level: "edit"}},
	} {
		candidate := valid
		candidate.ModulePermissions = permissions
		if err := validateEmployee(&candidate); err == nil {
			t.Fatalf("invalid module permissions accepted: %+v", permissions)
		}
	}
}

func TestManagementEmployeeEditPermissionCanUseRoleDefaults(t *testing.T) {
	employee := employeeDTO{
		FirstName: "Test", LastName: "Organizer", EmployeeCode: "T-03",
		Email: "organizer@example.com", Phone: "0812345678", Permission: "edit",
		JobRole: "organizer",
	}
	if err := validateEmployee(&employee); err != nil {
		t.Fatalf("organizer defaults should provide editable modules: %v", err)
	}
}

func TestInitializeNewEmployeePassword(t *testing.T) {
	user := models.User{}
	if err := initializeNewEmployeePassword(&user, "0812345678"); err != nil {
		t.Fatal(err)
	}
	if !user.MustChangePassword {
		t.Fatal("new employee must be forced to set a private password")
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("0812345678")) != nil {
		t.Fatal("initial phone credential was not hashed")
	}
}

func TestAccountActivityLabel(t *testing.T) {
	cases := []struct {
		name     string
		kind     string
		action   string
		want     string
		included bool
	}{
		{name: "staff login", kind: "staff", action: "เข้าสู่ระบบ", want: "เข้าสู่ระบบ", included: true},
		{name: "staff account creation", kind: "staff", action: "สร้างบัญชี", want: "สร้างบัญชี", included: true},
		{name: "staff permission change", kind: "staff", action: "เปลี่ยนสิทธิ์", want: "เปลี่ยนสิทธิ์", included: true},
		{name: "staff logout is excluded", kind: "staff", action: "ออกจากระบบ", included: false},
		{name: "staff promotion change is excluded", kind: "staff", action: "CREATE_PROMOTION", included: false},
		{name: "customer registration uses the shared label", kind: "user", action: "สมัครสมาชิก", want: "สร้างบัญชี", included: true},
		{name: "customer profile update uses the shared label", kind: "user", action: "แก้ไขโปรไฟล์", want: "แก้ไขบัญชี", included: true},
		{name: "customer password reset", kind: "user", action: "รีเซ็ตรหัสผ่าน", want: "รีเซ็ตรหัสผ่าน", included: true},
		{name: "customer logout is excluded", kind: "user", action: "ออกจากระบบ", included: false},
		{name: "customer booking is excluded", kind: "user", action: "จองบัตร", included: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, included := accountActivityLabel(tc.kind, tc.action)
			if got != tc.want || included != tc.included {
				t.Fatalf("accountActivityLabel(%q, %q) = %q, %v; want %q, %v", tc.kind, tc.action, got, included, tc.want, tc.included)
			}
		})
	}
}

func TestThailandWallTime(t *testing.T) {
	databaseWallTime := time.Date(2026, time.September, 10, 1, 18, 13, 0, time.UTC)

	got := thailandWallTime(databaseWallTime).Format(time.RFC3339)
	if got != "2026-09-10T01:18:13+07:00" {
		t.Fatalf("thailandWallTime() = %q; want Thailand wall-clock time with +07:00 offset", got)
	}
}

func TestEmployeeAccountActions(t *testing.T) {
	previous := employeeDTO{
		FirstName: "สมชาย", LastName: "ทดสอบ", EmployeeCode: "EMP-001", Department: "ฝ่ายขาย",
		Email: "staff@example.com", Phone: "0812345678", Permission: "view_only",
	}

	cases := []struct {
		name     string
		creating bool
		change   func(*employeeDTO)
		want     []string
	}{
		{name: "new employee", creating: true, want: []string{"สร้างบัญชี"}},
		{name: "profile only", change: func(e *employeeDTO) { e.Email = "new@example.com" }, want: []string{"แก้ไขบัญชี"}},
		{name: "permission only", change: func(e *employeeDTO) { e.Permission = "admin" }, want: []string{"เปลี่ยนสิทธิ์"}},
		{name: "profile and permission", change: func(e *employeeDTO) { e.Phone = "0899999999"; e.Permission = "admin" }, want: []string{"แก้ไขบัญชี", "เปลี่ยนสิทธิ์"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			input := previous
			if tc.change != nil {
				tc.change(&input)
			}
			got := employeeAccountActions(previous, input, tc.creating)
			if strings.Join(got, ",") != strings.Join(tc.want, ",") {
				t.Fatalf("employeeAccountActions() = %v; want %v", got, tc.want)
			}
		})
	}
}

func TestManagementBannerValidation(t *testing.T) {
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	valid := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buffer.Bytes())
	if _, err := promotionBanner(valid, nil); err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"blob:http://localhost/example", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,bm90IGEgcG5n", "javascript:alert(1)"} {
		if _, err := promotionBanner(value, nil); err == nil {
			t.Fatalf("accepted unsafe/invalid banner: %s", value)
		}
	}
}

// Opt-in only. All migrations and writes are isolated in a uniquely named schema.
// This never calls the existing tests that migrate/seed the application's public data.
func managementTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	if os.Getenv("MANAGEMENT_INTEGRATION_TEST") != "1" {
		t.Skip("set MANAGEMENT_INTEGRATION_TEST=1 to test PostgreSQL in an isolated schema")
	}
	values, err := godotenv.Read("../../.env")
	if err != nil && !os.IsNotExist(err) {
		t.Fatal(err)
	}
	value := func(key, fallback string) string {
		if current := os.Getenv(key); current != "" {
			return current
		}
		if current := values[key]; current != "" {
			return current
		}
		return fallback
	}
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		value("DB_HOST", "localhost"), value("DB_PORT", "5432"), value("DB_USER", "admin_T01SA"),
		value("DB_PASSWORD", "T01SA"), value("DB_NAME", "backend_T01"), value("DB_SSLMODE", "disable"))
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal("PostgreSQL connection failed:", err)
	}
	schema := "management_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err = admin.Exec(`CREATE SCHEMA "` + schema + `"`).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if !strings.HasPrefix(schema, "management_test_") || len(schema) != 48 {
			t.Error("unsafe test schema cleanup target")
			return
		}
		if err := admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`).Error; err != nil {
			t.Error(err)
		}
		sqlDB, _ := admin.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	})
	db, err := gorm.Open(postgres.Open(dsn+" search_path="+schema), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	})
	if err := models.MigrateAllModels(db); err != nil {
		t.Fatal(err)
	}
	return db
}

func managementRequest(t *testing.T, app *fiber.App, method, path string, payload interface{}, status int) map[string]interface{} {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != status {
		t.Fatalf("%s %s got %d want %d: %s", method, path, resp.StatusCode, status, body)
	}
	result := map[string]interface{}{}
	if len(body) > 0 {
		if err := json.Unmarshal(body, &result); err != nil {
			t.Fatalf("non-json: %s", body)
		}
	}
	return result
}

func TestManagementPostgres(t *testing.T) {
	db := managementTestDB(t)
	app := fiber.New(fiber.Config{BodyLimit: 20 * 1024 * 1024})
	RegisterManagementRoutes(app, db)
	managementRequest(t, app, "GET", "/api/employees", nil, 200)
	managementRequest(t, app, "GET", "/api/activity-logs?type=bad", nil, 400)
	employee := map[string]interface{}{"first_name": "ทดสอบ", "last_name": "สิทธิ์", "employee_code": "TEST-001", "email": "test@example.com", "phone": "0812345678", "department": "ฝ่ายการตลาด", "permission": "edit", "edit_scope": "promotions"}
	saved := managementRequest(t, app, "POST", "/api/employees", employee, 201)
	employeeID := saved["employee_id"].(string)
	reread := managementRequest(t, app, "GET", "/api/employees/"+employeeID, nil, 200)
	if reread["edit_scope"] != "promotions" {
		t.Fatal("scope not persisted")
	}
	managementRequest(t, app, "POST", "/api/employees", employee, 409)
	employee["permission"] = "admin"
	delete(employee, "edit_scope")
	managementRequest(t, app, "PUT", "/api/employees/"+employeeID, employee, 200)
	list := managementRequest(t, app, "GET", "/api/employees", nil, 200)
	if list["summary"].(map[string]interface{})["admin_count"] != float64(1) {
		t.Fatal("wrong admin summary")
	}
	// Employee APIs must never update customer records through a guessed ID.
	customer := models.User{UserID: "CUSTOMER_TEST", FirstName: "ลูกค้า", LastName: "ทดสอบ", Email: "customer@example.com", UserType: "customer", Role: "customer"}
	if err := db.Create(&customer).Error; err != nil {
		t.Fatal(err)
	}
	managementRequest(t, app, "PUT", "/api/employees/CUSTOMER_TEST", employee, 404)
	managementRequest(t, app, "DELETE", "/api/employees/CUSTOMER_TEST", nil, 404)

	concert := models.Concert{ConcertID: "CONCERT_TEST", ConcertName: "คอนเสิร์ตทดสอบ", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "Test", Status: "ยืนยันแล้ว"}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	zone := models.Zone{ZoneID: "ZONE_TEST", ZoneType: "VIP", Capacity: 100}
	if err := db.Create(&zone).Error; err != nil {
		t.Fatal(err)
	}
	managementRequest(t, app, "GET", "/api/promotions/options", nil, 200)
	promo := map[string]interface{}{"promotion_name": "ส่วนลดทดสอบ", "concert_id": "CONCERT_TEST", "discount_type": "percent", "discount_value": 10, "max_discount_amount": 100, "promo_code": "TEST10", "terms_detail": "เงื่อนไขทดสอบ", "max_usage_per_user": 1, "min_order_amount": 0, "start_date": "2027-01-01", "end_date": "2027-01-02", "total_quota": 100, "selected_zones": []string{"ZONE_TEST"}, "banner_image_url": ""}
	created := managementRequest(t, app, "POST", "/api/promotions", promo, 201)
	promoID := created["promotion_id"].(string)
	reread = managementRequest(t, app, "GET", "/api/promotions/"+promoID, nil, 200)
	if reread["status"] != "draft" {
		t.Fatal("new promotion must await approval")
	}
	if reread["discount_info"].(map[string]interface{})["discount_value"] != float64(10) {
		t.Fatal("discount not persisted")
	}
	managementRequest(t, app, "POST", "/api/promotions", promo, 409)
	promo["discount_value"] = 101
	managementRequest(t, app, "PUT", "/api/promotions/"+promoID, promo, 400)
	promo["discount_value"] = 10
	approvals := managementRequest(t, app, "GET", "/api/promotion-approvals", nil, 200)["data"].([]interface{})
	if len(approvals) != 1 {
		t.Fatalf("pending approval count %d", len(approvals))
	}
	approvalID := approvals[0].(map[string]interface{})["approval"].(map[string]interface{})["approval_id"].(string)
	requestedAt, err := time.Parse(time.RFC3339Nano, approvals[0].(map[string]interface{})["approval"].(map[string]interface{})["requested_at"].(string))
	if err != nil || time.Since(requestedAt) > time.Minute || time.Until(requestedAt) > time.Minute {
		t.Fatalf("approval timestamp changed timezone during roundtrip: %v %v", requestedAt, err)
	}
	// Simultaneous decisions must yield exactly one success, one conflict.
	statuses := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest("PATCH", "/api/promotion-approvals/"+approvalID, strings.NewReader(`{"status":"approved","remark":"ผ่านการตรวจสอบ"}`))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req, -1)
			if err != nil {
				statuses <- 0
				return
			}
			resp.Body.Close()
			statuses <- resp.StatusCode
		}()
	}
	wg.Wait()
	close(statuses)
	success, conflict := 0, 0
	for status := range statuses {
		if status == 200 {
			success++
		}
		if status == 409 {
			conflict++
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("concurrent decisions: successes=%d conflicts=%d", success, conflict)
	}
	reread = managementRequest(t, app, "GET", "/api/promotions/"+promoID, nil, 200)
	if reread["status"] != "active" {
		t.Fatal("approved status not persisted")
	}
	// Editing requires new approval and preserves the old decision.
	promo["promotion_name"] = "ปรับปรุงโปรโมชั่น"
	managementRequest(t, app, "PUT", "/api/promotions/"+promoID, promo, 200)
	approvals = managementRequest(t, app, "GET", "/api/promotion-approvals", nil, 200)["data"].([]interface{})
	if len(approvals) != 2 {
		t.Fatal("approval history lost on edit")
	}
	var pendingID string
	for _, raw := range approvals {
		a := raw.(map[string]interface{})["approval"].(map[string]interface{})
		if a["status"] == "pending" {
			pendingID = a["approval_id"].(string)
		}
	}
	if pendingID == "" {
		t.Fatal("new pending request missing")
	}
	managementRequest(t, app, "PATCH", "/api/promotion-approvals/"+pendingID, map[string]string{"status": "rejected", "remark": "ทดสอบปฏิเสธ"}, 200)
	reread = managementRequest(t, app, "GET", "/api/promotions/"+promoID, nil, 200)
	if reread["status"] != "draft" {
		t.Fatal("rejected promotion must stay draft")
	}
	managementRequest(t, app, "DELETE", "/api/promotions/"+promoID, nil, 204)
	managementRequest(t, app, "GET", "/api/promotions/"+promoID, nil, 404)
	var retained int64
	db.Unscoped().Model(&models.Promotion{}).Where("promotion_id = ?", promoID).Count(&retained)
	if retained != 1 {
		t.Fatal("soft delete should retain promotion")
	}
	managementRequest(t, app, "DELETE", "/api/employees/"+employeeID, nil, 204)
	managementRequest(t, app, "GET", "/api/employees/"+employeeID, nil, 404)
	db.Model(&models.User{}).Where("user_id = ? AND employee_inactive = true", employeeID).Count(&retained)
	if retained != 1 {
		t.Fatal("employee history reference lost")
	}
	allStaffLogs := managementRequest(t, app, "GET", "/api/activity-logs?type=staff", nil, 200)["data"].([]interface{})
	foundPromotionLog := false
	for _, raw := range allStaffLogs {
		if strings.Contains(raw.(map[string]interface{})["action_code"].(string), "PROMOTION") {
			foundPromotionLog = true
			break
		}
	}
	if !foundPromotionLog {
		t.Fatal("default staff activity contract lost promotion history")
	}
	logs := managementRequest(t, app, "GET", "/api/activity-logs?type=staff&scope=account", nil, 200)["data"].([]interface{})
	if len(logs) != 3 {
		t.Fatalf("account history returned %d events; want 3 account-only events", len(logs))
	}
	wantActivities := map[string]bool{"สร้างบัญชี": false, "เปลี่ยนสิทธิ์": false, "ปิดใช้งานบัญชี": false}
	for _, raw := range logs {
		row := raw.(map[string]interface{})
		activity := row["activity_type"].(string)
		if _, ok := wantActivities[activity]; !ok {
			t.Fatalf("non-account activity leaked into account history: %q", activity)
		}
		wantActivities[activity] = true
		if row["user_name"] != "ทดสอบ สิทธิ์" || row["user_code"] != "TEST-001" {
			t.Fatalf("account history did not resolve the target employee: %#v", row)
		}
	}
	for activity, found := range wantActivities {
		if !found {
			t.Fatalf("missing account activity %q", activity)
		}
	}

	// Images survive reads/edits; an explicit removal must also persist.
	var pngBuffer bytes.Buffer
	if err := png.Encode(&pngBuffer, image.NewRGBA(image.Rect(0, 0, 1, 1))); err != nil {
		t.Fatal(err)
	}
	promo["promo_code"] = "IMAGECHECK"
	promo["banner_image_url"] = "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBuffer.Bytes())
	imagePromo := managementRequest(t, app, "POST", "/api/promotions", promo, 201)
	imageID := imagePromo["promotion_id"].(string)
	imageURL := imagePromo["banner_image_url"].(string)
	if imageURL == "" {
		t.Fatal("image missing")
	}
	promo["banner_image_url"] = ""
	preserved := managementRequest(t, app, "PUT", "/api/promotions/"+imageID, promo, 200)
	if preserved["banner_image_url"] != imageURL {
		t.Fatal("empty edit erased existing image")
	}
	promo["remove_banner"] = true
	managementRequest(t, app, "PUT", "/api/promotions/"+imageID, promo, 200)
	removed := managementRequest(t, app, "GET", "/api/promotions/"+imageID, nil, 200)
	if removed["banner_image_url"] != "" {
		t.Fatal("explicit image removal was not persisted")
	}

	// Failed audit insertion must roll the entire business write back.
	if err := db.Exec(`ALTER TABLE emp_activity_logs ADD CONSTRAINT test_fail_audit CHECK (action_type <> 'CREATE_PROMOTION') NOT VALID`).Error; err != nil {
		t.Fatal(err)
	}
	promo["promo_code"] = "AUDITFAIL"
	managementRequest(t, app, "POST", "/api/promotions", promo, 500)
	var failedRows int64
	if err := db.Model(&models.DiscountInfo{}).Where("promo_code = ?", "AUDITFAIL").Count(&failedRows).Error; err != nil {
		t.Fatal(err)
	}
	if failedRows != 0 {
		t.Fatal("business data survived failed audit transaction")
	}
}

// Optional local browser fixture: a real API and PostgreSQL schema, never public data.
// POST /__management_test/finish closes the listener and removes the disposable schema.
func TestManagementBrowserFixture(t *testing.T) {
	if os.Getenv("MANAGEMENT_BROWSER_TEST") != "1" {
		t.Skip("browser fixture is opt-in")
	}
	db := managementTestDB(t)
	concert := models.Concert{ConcertID: "BROWSER_CONCERT", ConcertName: "คอนเสิร์ตทดสอบระบบ", StartDate: "2027-01-01", EndDate: "2027-01-02", StartTime: "18:00:00", EndTime: "22:00:00", Location: "สนามทดสอบ", Status: "ยืนยันแล้ว"}
	if err := db.Create(&concert).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&models.Zone{ZoneID: "BROWSER_ZONE", ZoneType: "VIP", Capacity: 100}).Error; err != nil {
		t.Fatal(err)
	}
	app := fiber.New(fiber.Config{BodyLimit: 20 * 1024 * 1024, DisableStartupMessage: true})
	RegisterManagementRoutes(app, db)
	done := make(chan struct{}, 1)
	app.Post("/__management_test/finish", func(c *fiber.Ctx) error {
		select {
		case done <- struct{}{}:
		default:
		}
		return c.SendStatus(204)
	})
	listener, err := net.Listen("tcp", "127.0.0.1:8080")
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		if err := app.Listener(listener); err != nil {
			t.Log(err)
		}
	}()
	t.Log("isolated PostgreSQL browser fixture ready at http://127.0.0.1:8080")
	select {
	case <-done:
	case <-time.After(20 * time.Minute):
		t.Error("browser fixture timed out")
	}
	if err := app.Shutdown(); err != nil {
		t.Error(err)
	}
}
