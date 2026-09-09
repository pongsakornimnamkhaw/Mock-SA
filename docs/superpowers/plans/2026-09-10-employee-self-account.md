# Employee Self-Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างหน้าบัญชีผู้ใช้ระบบหลังบ้านแบบ 3 แท็บ พร้อมประเภทบุคลากร ประวัติการทำงานของตนเอง และกระบวนการขอรีเซ็ตรหัสผ่านที่ผู้ดูแลยืนยันด้วยการโทรกลับเบอร์เดิม

**Architecture:** ขยายโมเดลผู้ใช้เดิมด้วย `personnel_type` และใช้ `emp_activity_logs` เดิมเป็นแหล่งประวัติ เพิ่ม API บัญชีที่ยึดตัวตนจากเซสชัน และเพิ่มตารางคำร้องรีเซ็ตรหัสผ่านที่เก็บเฉพาะค่าแฮชของโทเคน การบันทึกกิจกรรมจากโมดูลหลังบ้านทำผ่าน middleware ที่ทำงานเฉพาะเมื่อพบเซสชันพนักงาน จึงไม่เปลี่ยนพฤติกรรมของ API เดิมที่ไม่มีเซสชัน

**Tech Stack:** Go 1.26, Fiber v2, GORM, PostgreSQL, bcrypt, React 19, TypeScript 6, Material UI 9, React Router 7, Vitest และ Testing Library

**Spec:** `docs/superpowers/specs/2026-09-10-employee-self-account-design.md`

## Global Constraints

- คง `UserType` สำหรับแยกลูกค้ากับผู้ใช้ระบบหลังบ้าน และใช้ `personnel_type` เฉพาะแยก `internal` กับ `external`
- บัญชีหลังบ้านเดิมต้องกลายเป็น `internal`; บัญชีลูกค้าไม่ต้องมีประเภทบุคลากร
- รหัสผู้ใช้สำหรับข้อมูลบัญชี ประวัติ และการอนุมัติต้องมาจากเซสชันฝั่งเซิร์ฟเวอร์
- บุคลากรภายในแก้ได้เฉพาะเบอร์โทร; บุคลากรภายนอกแก้อีเมลและเบอร์โทรได้
- ประวัติใช้เวลาประเทศไทยและไม่บันทึกรหัสผ่านหรือโทเคนจริง
- การรีเซ็ตต้องใช้เบอร์เดิมจากฐานข้อมูล ผู้ดูแลบทบาท `admin` โทรกลับและยืนยันรหัสคำร้อง
- คำร้องผูกกับเบราว์เซอร์ ใช้ครั้งเดียว และหมดอายุ 30 นาทีหลังอนุมัติ
- API เดิมที่ไม่มีเซสชันต้องไม่เปลี่ยนพฤติกรรมจากงานนี้
- รักษาการแก้ไขที่มีอยู่ใน worktree และ stage/commit เฉพาะไฟล์ของแต่ละงาน

## File Map

- `backend/internal/models/user.go`: เพิ่มประเภทบุคลากรในผู้ใช้
- `backend/internal/models/employee_password_reset.go`: โมเดลและค่าคงที่ของคำร้องรีเซ็ต
- `backend/internal/models/migrate.go`: ลงทะเบียนโมเดลใหม่และ backfill พนักงานเดิม
- `backend/internal/handlers/employee_session.go`: แยกการอ่านเซสชันให้ API บัญชีและ audit ใช้ร่วมกัน
- `backend/internal/handlers/employee_account.go`: โปรไฟล์ รหัสผ่าน และประวัติของผู้ใช้ปัจจุบัน
- `backend/internal/handlers/employee_password_reset.go`: สร้างคำร้อง ตรวจสถานะ ตั้งรหัสใหม่ และการตัดสินโดยแอดมิน
- `backend/internal/handlers/employee_audit.go`: บันทึกคำขอแก้ข้อมูลของหลังบ้านที่สำเร็จ
- `backend/internal/handlers/employee_*_test.go`: ทดสอบสัญญา API ความปลอดภัย และการบันทึกประวัติ
- `frontend/src/api/employeeAccountApi.ts`: สัญญา API ของหน้าบัญชีและคำร้อง
- `frontend/src/utils/employeeSession.ts`: เพิ่ม `personnelType` และอัปเดต session UI
- `frontend/src/pages/Employee/Account/*`: หน้า 3 แท็บและการทดสอบ
- `frontend/src/pages/Employee/PasswordRecovery/*`: ขั้นตอนสร้างคำร้อง รออนุมัติ และตั้งรหัสใหม่
- `frontend/src/pages/Employee/employees/PasswordResetRequestsPanel.tsx`: รายการคำร้องสำหรับแอดมิน
- `frontend/src/pages/Employee/employees/EmployeeFormPage.tsx`: ช่องเลือกประเภทบุคลากร
- `frontend/src/components/layout/Sidebar.tsx`: ลิงก์บัญชีและตัวเลขคำร้องรออนุมัติ
- `frontend/src/App.tsx`: route ใหม่ที่มี guard

---

### Task 1: โมเดลประเภทบุคลากรและคำร้องรีเซ็ตรหัสผ่าน

**Files:**
- Modify: `backend/internal/models/user.go`
- Create: `backend/internal/models/employee_password_reset.go`
- Modify: `backend/internal/models/migrate.go`
- Create: `backend/internal/models/employee_password_reset_test.go`

**Interfaces:**
- Produces: `models.PersonnelTypeInternal`, `models.PersonnelTypeExternal`, `models.EmployeePasswordResetRequest`
- Produces fields used later: `User.PersonnelType string`, `EmpActivityLogs.Module string`, request status constants, `ExpiresAt *time.Time`

- [ ] **Step 1: Write the failing migration and model tests**

```go
func TestEmployeePasswordResetRequestBeforeCreate(t *testing.T) {
    request := EmployeePasswordResetRequest{}
    if err := request.BeforeCreate(nil); err != nil { t.Fatal(err) }
    if !strings.HasPrefix(request.RequestID, "ER") { t.Fatalf("id=%q", request.RequestID) }
}

func TestPersonnelTypeConstants(t *testing.T) {
    if PersonnelTypeInternal != "internal" || PersonnelTypeExternal != "external" {
        t.Fatal("unexpected personnel type values")
    }
}

func TestEmployeeActivityLogAcceptsModule(t *testing.T) {
    log := EmpActivityLogs{Module: "คอนเสิร์ต"}
    if log.Module != "คอนเสิร์ต" { t.Fatalf("module=%q", log.Module) }
}
```

- [ ] **Step 2: Run the model tests and confirm they fail**

Run: `cd backend; go test ./internal/models -run 'Test(EmployeePasswordResetRequest|PersonnelType)' -count=1`

Expected: FAIL because the model and constants do not exist.

- [ ] **Step 3: Add the model and migration**

```go
const (
    PersonnelTypeInternal = "internal"
    PersonnelTypeExternal = "external"
    EmployeeResetPending  = "pending"
    EmployeeResetApproved = "approved"
    EmployeeResetRejected = "rejected"
    EmployeeResetUsed     = "used"
    EmployeeResetExpired  = "expired"
)

type EmployeePasswordResetRequest struct {
    RequestID       string     `gorm:"primaryKey;type:varchar(50)"`
    ReferenceCode  string     `gorm:"type:varchar(30);uniqueIndex;not null"`
    UserID          string     `gorm:"type:varchar(50);index;not null"`
    BrowserTokenHash string    `gorm:"type:varchar(64);uniqueIndex;not null"`
    Status          string     `gorm:"type:varchar(20);index;not null"`
    ApprovedBy      *string    `gorm:"type:varchar(50)"`
    RejectionReason string     `gorm:"type:text"`
    PhoneVerifiedAt *time.Time `gorm:"type:timestamp without time zone"`
    ApprovedAt      *time.Time `gorm:"type:timestamp without time zone"`
    ExpiresAt       *time.Time `gorm:"type:timestamp without time zone;index"`
    UsedAt          *time.Time `gorm:"type:timestamp without time zone"`
    CreatedAt       time.Time  `gorm:"type:timestamp without time zone;autoCreateTime;index"`
}
```

Add `PersonnelType string` to `User`, add optional `Module string` to `EmpActivityLogs`, include the reset model in `AutoMigrate`, and run a parameterized backfill after migration:

```go
db.Model(&User{}).
    Where("(LOWER(user_type) IN ? OR employee_code IS NOT NULL) AND COALESCE(personnel_type, '') = ''", []string{"employee", "staff", "admin", "พนักงาน"}).
    Update("personnel_type", PersonnelTypeInternal)
```

- [ ] **Step 4: Run focused tests and compile all backend packages**

Run: `cd backend; go test ./internal/models -count=1; go test ./... -run '^$'`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/internal/models/user.go backend/internal/models/employee_password_reset.go backend/internal/models/migrate.go backend/internal/models/employee_password_reset_test.go
git commit -m "feat: add employee account recovery models"
```

### Task 2: ตัวตนจากเซสชันและ API บัญชีพนักงาน

**Files:**
- Create: `backend/internal/handlers/employee_session.go`
- Modify: `backend/internal/handlers/employee_auth.go`
- Create: `backend/internal/handlers/employee_account.go`
- Create: `backend/internal/handlers/employee_account_test.go`

**Interfaces:**
- Consumes: `models.User.PersonnelType`, `models.EmpActivityLogs`
- Produces: `loadEmployeeFromRequest(c, db) (models.User, error)`, `requireEmployee`, `requireAdmin`
- Produces routes: `GET /api/employee/account`, `PATCH /api/employee/account/profile`, `PATCH /api/employee/account/password`, `GET /api/employee/account/activity`

- [ ] **Step 1: Write failing API tests**

```go
func TestEmployeeAccountProfileRules(t *testing.T) {
    // internal: email change returns 403, phone change returns 200
    // external: email and phone change return 200
}

func TestEmployeeAccountPasswordAndActivityAreSessionScoped(t *testing.T) {
    // wrong current password returns 400
    // correct password creates one "เปลี่ยนรหัสผ่าน" log
    // activity response excludes another employee's rows
}
```

Use `managementTestDB(t)`, create a real bcrypt hash, call `startSession`, copy the returned cookie into requests, and assert database values after each request.

- [ ] **Step 2: Run the account tests and confirm they fail**

Run: `cd backend; go test ./internal/handlers -run '^TestEmployeeAccount' -count=1 -v`

Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Extract reusable session lookup without changing login behavior**

```go
func loadEmployeeFromRequest(c *fiber.Ctx, db *gorm.DB) (models.User, error) {
    token := employeeTokenFromRequest(c)
    if token == "" { return models.User{}, fiber.ErrUnauthorized }
    var session models.EmpActivityLogs
    if err := db.Where("action_type = ? AND target_id = ?", employeeSessionAction, hashEmployeeSessionToken(token)).First(&session).Error; err != nil {
        return models.User{}, fiber.ErrUnauthorized
    }
    var user models.User
    if session.UserID == nil || db.First(&user, "user_id = ? AND employee_inactive = ?", *session.UserID, false).Error != nil {
        return models.User{}, fiber.ErrUnauthorized
    }
    return user, nil
}
```

Make `employeeAuthHandler.requireEmployee` call this helper and place the result in `c.Locals("employeeUser", user)`.

- [ ] **Step 4: Implement account detail, profile, password, latest login, and activity endpoints**

```go
type employeeProfileInput struct { Email string `json:"email"`; Phone string `json:"phone"` }
type employeePasswordInput struct {
    CurrentPassword string `json:"current_password"`
    NewPassword string `json:"new_password"`
    ConfirmPassword string `json:"confirm_password"`
}
```

The account detail response extends `employeeAccountDTO` with `personnel_type`, `last_login_at`, and `active`. Validate email and phone with the existing employee validation rules. Reject email changes unless `PersonnelTypeExternal`. Validate new passwords with a shared `validateNewEmployeePassword` that requires at least 8 characters, hash with bcrypt, remove all other `EMPLOYEE_AUTH_SESSION` rows for that user while retaining the current session, and create an audit row with `UserID` set. Activity filtering accepts `from`, `to`, `module`, `action`, `page`, and `page_size`, caps page size at 50, excludes session rows, and returns `{data, page, page_size, total}`.

- [ ] **Step 5: Run focused account tests**

Run: `cd backend; go test ./internal/handlers -run '^TestEmployeeAccount' -count=1 -v`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add backend/internal/handlers/employee_session.go backend/internal/handlers/employee_auth.go backend/internal/handlers/employee_account.go backend/internal/handlers/employee_account_test.go
git commit -m "feat: add employee self account API"
```

### Task 3: บันทึกกิจกรรมหลังบ้านแบบผูกผู้กระทำ

**Files:**
- Create: `backend/internal/handlers/employee_audit.go`
- Create: `backend/internal/handlers/employee_audit_test.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/internal/handlers/management.go`
- Modify: `backend/internal/handlers/booking_payment.go`

**Interfaces:**
- Consumes: `loadEmployeeFromRequest`, `models.EmpActivityLogs`
- Produces: `RegisterEmployeeAuditMiddleware(app *fiber.App, db *gorm.DB)` and `employeeAuditMetadata(method, path string) (action, module string, ok bool)`

- [ ] **Step 1: Write failing audit middleware tests**

```go
func TestEmployeeAuditRecordsSuccessfulMutationsOnce(t *testing.T) {
    // POST /api/artists with an employee cookie records user_id, action "เพิ่ม", module "ศิลปิน"
    // a 400 response records nothing
    // a request without an employee cookie keeps its original response and records nothing
}

func TestEmployeeAuditDoesNotDuplicateExistingManagementLog(t *testing.T) {
    // one promotion mutation creates one visible row for the actor
}
```

- [ ] **Step 2: Run audit tests and confirm they fail**

Run: `cd backend; go test ./internal/handlers -run '^TestEmployeeAudit' -count=1 -v`

Expected: FAIL because middleware is undefined.

- [ ] **Step 3: Implement optional audit middleware**

```go
func EmployeeAuditMiddleware(db *gorm.DB) fiber.Handler {
    return func(c *fiber.Ctx) error {
        user, authErr := loadEmployeeFromRequest(c, db)
        err := c.Next()
        if authErr != nil || err != nil || c.Response().StatusCode() < 200 || c.Response().StatusCode() >= 300 {
            return err
        }
        action, module, ok := employeeAuditMetadata(c.Method(), c.Path())
        if !ok { return err }
        target := firstNonEmpty(c.Params("id"), c.Params("taskId"), c.Params("docId"))
        _ = createEmployeeAudit(db, user.UserID, action, module, target)
        return err
    }
}
```

Register it after CORS and before route registration. The route map must cover employee mutations for concerts, artists, schedules, requirements, venue layouts, work plans, promotions, approvals, employees, and sales booking decisions. Exclude login, logout, account profile/password, password reset, customer booking creation, and customer account routes because those write their own audit or are not employee operations.

- [ ] **Step 4: Convert existing management and booking audit rows to use the session actor or exclude them from middleware**

For handlers that already create richer descriptions, set `UserID` from an optional employee resolved before the mutation. Mark those route patterns excluded in `employeeAuditMetadata` so each successful action yields one row. Preserve existing behavior when no session exists by leaving `UserID` nil.

- [ ] **Step 5: Run audit, management, and compile checks**

Run: `cd backend; go test ./internal/handlers -run '^(TestEmployeeAudit|TestManagement)' -count=1 -v; go test ./... -run '^$'`

Expected: PASS with no duplicate rows.

- [ ] **Step 6: Commit Task 3**

```bash
git add backend/internal/handlers/employee_audit.go backend/internal/handlers/employee_audit_test.go backend/internal/handlers/management.go backend/internal/handlers/booking_payment.go backend/cmd/server/main.go
git commit -m "feat: attribute back office activity to employees"
```

### Task 4: คำร้องรีเซ็ตรหัสผ่านและการอนุมัติด้วยการโทรกลับ

**Files:**
- Create: `backend/internal/handlers/employee_password_reset.go`
- Create: `backend/internal/handlers/employee_password_reset_test.go`
- Modify: `backend/internal/handlers/employee_auth.go`

**Interfaces:**
- Produces public routes: `POST /api/employee/auth/password-reset/requests`, `GET /api/employee/auth/password-reset/status`, `POST /api/employee/auth/password-reset/complete`
- Produces admin routes: `GET /api/employee/password-reset-requests`, `GET /api/employee/password-reset-requests/count`, `PATCH /api/employee/password-reset-requests/:id`
- Browser token travels in header `X-Employee-Reset-Token`; only SHA-256 hex is stored

- [ ] **Step 1: Write failing reset flow tests**

```go
func TestEmployeePasswordResetFlow(t *testing.T) {
    // request returns reference_code and browser_token
    // non-admin approval returns 403
    // approval without phone_verified=true returns 400
    // admin approval sets PhoneVerifiedAt, ApprovedAt, ExpiresAt=ApprovedAt+30m
    // matching token can complete once and old sessions are deleted
}

func TestEmployeePasswordResetRejectsWrongOrExpiredToken(t *testing.T) {
    // wrong token, expired request, rejected request, and used request cannot reset
}

func TestEmployeePasswordResetDoesNotEnumerateAccounts(t *testing.T) {
    // unknown identifier has the same status and response shape as a known identifier
}
```

- [ ] **Step 2: Run reset tests and confirm they fail**

Run: `cd backend; go test ./internal/handlers -run '^TestEmployeePasswordReset' -count=1 -v`

Expected: FAIL because routes are missing.

- [ ] **Step 3: Implement request creation and browser-bound status**

Generate 32 random bytes for the browser token and a non-secret reference code such as `RST-123456`. Persist only `sha256(token)`. For unknown identifiers, return a random reference and token using the same HTTP 202 response without creating a row. Status lookup returns only `pending`, `approved`, `rejected`, `used`, or `expired` and never returns phone, user ID, or password data.

- [ ] **Step 4: Implement admin list, count, approve, and reject**

```go
type employeeResetDecisionInput struct {
    Decision      string `json:"decision"`
    PhoneVerified bool   `json:"phone_verified"`
    Reason        string `json:"reason"`
}
```

Require `currentEmployee(c).Role == "admin"`. Approval requires `PhoneVerified == true`; write `ApprovedBy`, `PhoneVerifiedAt`, `ApprovedAt`, and `ExpiresAt`. Rejection requires a non-empty reason. Lock the request row in a transaction and accept decisions only from `pending`.

- [ ] **Step 5: Implement one-time password completion**

Validate the token hash, approved status, expiry, password confirmation, and the shared minimum length of 8 characters. In one transaction update `PasswordHash`, mark the request `used`, set `UsedAt`, delete every employee session for the user, expire other pending requests, and add one `รีเซ็ตรหัสผ่าน` audit row without secret values.

- [ ] **Step 6: Run reset and account tests**

Run: `cd backend; go test ./internal/handlers -run '^(TestEmployeePasswordReset|TestEmployeeAccount)' -count=1 -v`

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add backend/internal/handlers/employee_password_reset.go backend/internal/handlers/employee_password_reset_test.go backend/internal/handlers/employee_auth.go
git commit -m "feat: add admin-approved employee password recovery"
```

### Task 5: สัญญา API และประเภทข้อมูลฝั่งหน้าจอ

**Files:**
- Modify: `frontend/src/utils/employeeSession.ts`
- Modify: `frontend/src/api/employeeAuthApi.ts`
- Create: `frontend/src/api/employeeAccountApi.ts`
- Create: `frontend/src/api/employeeAccountApi.test.ts`
- Modify: `frontend/src/types/promotion.ts`

**Interfaces:**
- Produces: `PersonnelType`, `EmployeeActivity`, `EmployeeResetRequest`, `employeeAccountApi`
- Produces session field: `personnelType: 'internal' | 'external'`

- [ ] **Step 1: Write failing API mapping tests**

```ts
it('maps personnel_type and sends credentials', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    data: { user_id: 'US1', personnel_type: 'external', name: 'ผู้ทดสอบ' },
  }), { status: 200 })))
  const profile = await employeeAccountApi.getProfile()
  expect(profile.personnelType).toBe('external')
  expect(fetch).toHaveBeenCalledWith('/api/employee/account', expect.objectContaining({ credentials: 'include' }))
})
```

Also test profile patch, password patch, paginated activity query, request creation, token header status, completion, admin count/list, and decision error messages.

- [ ] **Step 2: Run API tests and confirm they fail**

Run: `cd frontend; npm test -- --run src/api/employeeAccountApi.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement typed API client**

```ts
export type PersonnelType = 'internal' | 'external'
export interface EmployeeActivityPage {
  data: EmployeeActivity[]
  page: number
  pageSize: number
  total: number
}
```

Every authenticated call uses `credentials: 'include'`. Store the reset token only in `sessionStorage` under `octavia-employee-reset-v1`; never copy it into URLs, logs, or local storage. Extend both login and `getMe` mappers with `personnel_type` and `last_login_at`.

- [ ] **Step 4: Run API tests and TypeScript build**

Run: `cd frontend; npm test -- --run src/api/employeeAccountApi.test.ts; npm run build`

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add frontend/src/utils/employeeSession.ts frontend/src/api/employeeAuthApi.ts frontend/src/api/employeeAccountApi.ts frontend/src/api/employeeAccountApi.test.ts frontend/src/types/promotion.ts
git commit -m "feat: add employee account frontend API"
```

### Task 6: หน้า “บัญชีของฉัน” แบบ 3 แท็บ

**Files:**
- Create: `frontend/src/pages/Employee/Account/index.tsx`
- Create: `frontend/src/pages/Employee/Account/ProfileTab.tsx`
- Create: `frontend/src/pages/Employee/Account/SecurityTab.tsx`
- Create: `frontend/src/pages/Employee/Account/ActivityTab.tsx`
- Create: `frontend/src/pages/Employee/Account/EmployeeAccountPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `employeeAccountApi`, `saveEmployeeSession`, shared `Pagination`
- Produces route: `/employee/account`

- [ ] **Step 1: Write failing page tests**

```tsx
it('keeps internal email readonly and allows phone editing', async () => {
  renderAccount({ personnelType: 'internal' })
  expect(await screen.findByLabelText('อีเมล')).toBeDisabled()
  expect(screen.getByLabelText('เบอร์โทรศัพท์')).toBeEnabled()
})

it('shows only server-provided activity and formats Bangkok time', async () => {
  renderAccount({ personnelType: 'external' })
  await userEvent.click(screen.getByRole('tab', { name: 'ประวัติการทำงานของฉัน' }))
  expect(await screen.findByText('10/09/2569 01:19 น.')).toBeInTheDocument()
})
```

Test external email edit, password validation, successful save updating the sidebar session, filters, pagination, empty state, API error, and logout.

- [ ] **Step 2: Run page tests and confirm they fail**

Run: `cd frontend; npm test -- --run src/pages/Employee/Account/EmployeeAccountPage.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the account shell and profile tab**

Use Material UI `Tabs`, `Paper`, responsive `Grid`, and the existing visual palette. Show read-only identity/permission fields. Enable email only for `external`, enable phone for both, and save only `{email, phone}`. On success merge the returned account into `saveEmployeeSession`.

- [ ] **Step 4: Implement security and activity tabs**

Security requires current password, new password, and confirmation; clear all password fields after success. Activity sends filters to the server, renders rows from newest to oldest, and formats dates with:

```ts
new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date(value))
```

- [ ] **Step 5: Add guarded route and clickable sidebar identity**

Add `/employee/account` inside `EmployeeRouteGuard` and `PromotionLayout`. Wrap only the avatar/name/details area in an accessible button that navigates there; keep the existing logout icon as a separate button and stop event propagation.

- [ ] **Step 6: Run page tests and build**

Run: `cd frontend; npm test -- --run src/pages/Employee/Account/EmployeeAccountPage.test.tsx; npm run build`

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add frontend/src/pages/Employee/Account frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add employee self account page"
```

### Task 7: ประเภทบุคลากรและคำร้องในหน้าจัดการพนักงาน

**Files:**
- Modify: `backend/internal/handlers/management_employees.go`
- Modify: `backend/internal/handlers/management_test.go`
- Modify: `frontend/src/pages/Employee/employees/EmployeeFormPage.tsx`
- Modify: `frontend/src/pages/Employee/employees/EmployeeListPage.tsx`
- Create: `frontend/src/pages/Employee/employees/PasswordResetRequestsPanel.tsx`
- Create: `frontend/src/pages/Employee/employees/PasswordResetRequestsPanel.test.tsx`
- Modify: `frontend/src/api/managementApi.ts`
- Modify: `frontend/src/types/promotion.ts`

**Interfaces:**
- Consumes: admin reset endpoints and `PersonnelType`
- Produces: employee create/update payload field `personnel_type`

- [ ] **Step 1: Extend failing backend management tests**

Assert create/update accepts only `internal` or `external`, persists the value, includes it in the DTO, defaults an omitted value to `internal` for compatibility, and rejects another value with 400.

- [ ] **Step 2: Run management tests and confirm the new assertions fail**

Run: `cd backend; go test ./internal/handlers -run '^TestManagement' -count=1 -v`

Expected: FAIL because DTO and validation omit `personnel_type`.

- [ ] **Step 3: Add personnel type to management API**

```go
type employeeDTO struct {
    // existing fields
    PersonnelType string `json:"personnel_type"`
}
```

Map the field in `employeeView`, normalize omitted input to `internal`, validate the two accepted values, and include it in the explicit update map.

- [ ] **Step 4: Write failing frontend admin tests**

```tsx
it('requires phone verification before approval', async () => {
  render(<PasswordResetRequestsPanel />)
  await screen.findByText('RST-123456')
  expect(screen.getByRole('button', { name: 'อนุมัติ' })).toBeDisabled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'โทรยืนยันกับเบอร์เดิมแล้ว' }))
  expect(screen.getByRole('button', { name: 'อนุมัติ' })).toBeEnabled()
})
```

Test reject reason, pending count, loading, empty state, and API errors.

- [ ] **Step 5: Implement personnel type input and reset request panel**

Add a required select labeled “ประเภทบุคลากร” to create/edit employee. Add tabs “รายชื่อพนักงาน” and “คำร้องรีเซ็ตรหัสผ่าน” to the list page. The panel displays reference, employee, type, department, registered phone, request time, status, verification checkbox, approve, and reject controls. Render the panel only when the current session role is `admin`.

- [ ] **Step 6: Run backend and frontend focused tests**

Run: `cd backend; go test ./internal/handlers -run '^TestManagement' -count=1 -v`

Run: `cd frontend; npm test -- --run src/pages/Employee/employees/PasswordResetRequestsPanel.test.tsx; npm run build`

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add backend/internal/handlers/management_employees.go backend/internal/handlers/management_test.go frontend/src/pages/Employee/employees/EmployeeFormPage.tsx frontend/src/pages/Employee/employees/EmployeeListPage.tsx frontend/src/pages/Employee/employees/PasswordResetRequestsPanel.tsx frontend/src/pages/Employee/employees/PasswordResetRequestsPanel.test.tsx frontend/src/api/managementApi.ts frontend/src/types/promotion.ts
git commit -m "feat: manage employee types and reset requests"
```

### Task 8: หน้าขอรีเซ็ต รออนุมัติ และตั้งรหัสผ่านใหม่

**Files:**
- Create: `frontend/src/pages/Employee/PasswordRecovery/index.tsx`
- Create: `frontend/src/pages/Employee/PasswordRecovery/EmployeePasswordRecovery.test.tsx`
- Modify: `frontend/src/pages/Employee/Login/index.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `employeeAccountApi.createResetRequest`, `.getResetStatus`, `.completeReset`, `.getPendingResetCount`
- Produces route: `/employee/forgot-password`

- [ ] **Step 1: Write failing recovery flow tests**

```tsx
it('moves from request to waiting and then reset on approval', async () => {
  renderRecovery()
  await userEvent.type(screen.getByLabelText('รหัสพนักงานหรืออีเมล'), 'B6728786')
  await userEvent.click(screen.getByRole('button', { name: 'ส่งคำร้อง' }))
  expect(await screen.findByText('RST-123456')).toBeInTheDocument()
  await vi.advanceTimersByTimeAsync(5000)
  expect(await screen.findByLabelText('รหัสผ่านใหม่')).toBeInTheDocument()
})
```

Test generic submission response, rejected status with reason, expired status, missing session token requiring a new request, completion success returning to login, and timer cleanup on unmount.

- [ ] **Step 2: Run recovery tests and confirm they fail**

Run: `cd frontend; npm test -- --run src/pages/Employee/PasswordRecovery/EmployeePasswordRecovery.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the three recovery states**

State 1 accepts identifier and stores `{referenceCode, token}` in session storage. State 2 displays the reference prominently, instructs the user that the admin will call the registered number, and polls every 5 seconds. State 3 validates and submits new/confirm password. Never display the registered phone on the public page.

- [ ] **Step 4: Connect login and admin notification badge**

Add “ลืมรหัสผ่าน” to employee login. Add the route without `EmployeeRouteGuard`. In the sidebar, if `employee.role === 'admin'`, load pending count on mount and every 60 seconds, render a badge beside “จัดการสิทธิ์พนักงาน”, and clear the interval on unmount. A count failure must not affect sidebar navigation.

- [ ] **Step 5: Run recovery, sidebar, and build checks**

Run: `cd frontend; npm test -- --run src/pages/Employee/PasswordRecovery/EmployeePasswordRecovery.test.tsx src/pages/Employee/employees/PasswordResetRequestsPanel.test.tsx; npm run build`

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add frontend/src/pages/Employee/PasswordRecovery frontend/src/pages/Employee/Login/index.tsx frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add employee password recovery UI"
```

### Task 9: ตรวจสอบร่วมทั้งระบบและเอกสารการใช้งาน

**Files:**
- Modify: `backend/MANAGEMENT.md`
- Modify: `docs/superpowers/plans/2026-09-10-employee-self-account.md`

**Interfaces:**
- Consumes: all tasks above
- Produces: verified commands and operator instructions

- [ ] **Step 1: Run backend focused suites**

Run: `cd backend; go test ./internal/models ./internal/handlers -count=1`

Expected: PASS. Do not run the unrelated destructive integration suite against the working database.

- [ ] **Step 2: Run backend compile check**

Run: `cd backend; go test ./... -run '^$'`

Expected: PASS.

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend; npm test -- --run`

Expected: PASS.

- [ ] **Step 4: Run frontend lint and production build**

Run: `cd frontend; npm run lint; npm run build`

Expected: PASS.

- [ ] **Step 5: Perform manual smoke test**

Start backend with `cd backend; go run .\cmd\server` and frontend with `cd frontend; npm run dev`. Verify internal and external profile rules, password change, Thai activity time, one audit row per mutation, admin badge, phone-confirmed approval, browser-bound completion, expiry, and logout. Confirm customer login, booking, concert, artist, venue, promotion, employee management, and reports still open and perform their existing read operations.

- [ ] **Step 6: Document operation and migration behavior**

Add to `backend/MANAGEMENT.md`: new routes, `personnel_type` meanings, automatic internal backfill, admin phone-verification procedure, 30-minute approval expiry, reset token handling, and verification commands.

- [ ] **Step 7: Record final verification evidence in this plan**

Under this task, append a dated “ผลการตรวจสอบ” section containing each command, exit code, and test count after running the commands.

- [ ] **Step 8: Commit Task 9**

```bash
git add backend/MANAGEMENT.md docs/superpowers/plans/2026-09-10-employee-self-account.md
git commit -m "docs: verify employee account workflow"
```
