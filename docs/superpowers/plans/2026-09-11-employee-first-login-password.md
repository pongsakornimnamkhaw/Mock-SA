# Employee First-Login Password Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every newly administrator-created employee to set a private password before receiving access to the staff portal.

**Architecture:** Persist a `must_change_password` flag on the employee and a hashed, expiring, one-time onboarding token. Login verifies the initial phone-based credential but returns only an onboarding capability; a dedicated public endpoint consumes it transactionally, after which the employee logs in normally.

**Tech Stack:** Go, Fiber, GORM, PostgreSQL, bcrypt, React, TypeScript, React Router, MUI, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-employee-first-login-password-design.md`

## Global Constraints

- Existing employees and seed accounts retain their current passwords and `must_change_password = false`.
- Setup tokens live for 30 minutes, are single-use, and are stored only as SHA-256 hashes in the database.
- No staff session is created until the employee completes setup and logs in again.
- Raw setup tokens must not appear in URLs, logs, audit records, or database rows.
- Normal successful employee login always navigates to `/dashboard`.

---

### Task 1: Persist first-login state and onboarding tokens

**Files:**
- Modify: `backend/internal/models/user.go`
- Create: `backend/internal/models/employee_password_setup.go`
- Modify: `backend/internal/models/migrate.go`
- Test: `backend/internal/models/employee_password_setup_test.go`

**Interfaces:**
- Produces: `User.MustChangePassword bool`
- Produces: `EmployeePasswordSetupToken{TokenID, UserID, TokenHash, ExpiresAt, UsedAt, CreatedAt}`

- [ ] **Step 1: Write the failing model/migration test**

```go
func TestEmployeePasswordSetupTokenDefaults(t *testing.T) {
    token := EmployeePasswordSetupToken{UserID: "U1", TokenHash: "hash"}
    if token.UsedAt != nil { t.Fatal("new token must be unused") }
    if _, ok := reflect.TypeOf(User{}).FieldByName("MustChangePassword"); !ok {
        t.Fatal("User.MustChangePassword is missing")
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `go test ./internal/models -run TestEmployeePasswordSetupTokenDefaults -count=1`

Expected: compilation failure because the new types and field do not exist.

- [ ] **Step 3: Add the model and migration registration**

```go
type EmployeePasswordSetupToken struct {
    TokenID   string     `gorm:"primaryKey;type:varchar(50);not null"`
    UserID    string     `gorm:"type:varchar(50);not null;index"`
    TokenHash string     `gorm:"type:varchar(64);not null;uniqueIndex"`
    ExpiresAt time.Time  `gorm:"not null"`
    UsedAt    *time.Time
    CreatedAt time.Time  `gorm:"not null"`
}
```

Add `MustChangePassword bool` with `gorm:"not null;default:false"` to `User`, and include `&EmployeePasswordSetupToken{}` in `MigrateAllModels`.

- [ ] **Step 4: Run model tests and verify GREEN**

Run: `go test ./internal/models -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the model change**

```bash
git add backend/internal/models/user.go backend/internal/models/employee_password_setup.go backend/internal/models/migrate.go backend/internal/models/employee_password_setup_test.go
git commit -m "feat: persist employee first-login setup state"
```

### Task 2: Initialize newly created employees safely

**Files:**
- Modify: `backend/internal/handlers/management_employees.go`
- Modify: `backend/internal/handlers/management_test.go`

**Interfaces:**
- Consumes: `User.MustChangePassword`
- Produces: new employees with `PasswordHash = bcrypt(phone)` and `MustChangePassword = true`

- [ ] **Step 1: Write failing creation tests**

Add an integration assertion after `POST /api/management/employees`:

```go
var stored models.User
db.First(&stored, "email = ?", input.Email)
if !stored.MustChangePassword { t.Fatal("new employee must require setup") }
if bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte(input.Phone)) != nil {
    t.Fatal("initial phone credential was not hashed")
}
```

Also update an existing employee and assert its password hash and flag remain unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `go test ./internal/handlers -run 'TestManagement.*Employee' -count=1`

Expected: new employee has an empty hash or `MustChangePassword == false`.

- [ ] **Step 3: Hash the phone only on creation**

Inside the create branch, before `Create(&u)`:

```go
passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Phone), bcrypt.DefaultCost)
if err != nil { return err }
u.PasswordHash = string(passwordHash)
u.MustChangePassword = true
```

Do not include either field in the existing employee update map.

- [ ] **Step 4: Run focused handler tests and verify GREEN**

Run: `go test ./internal/handlers -run 'TestManagement.*Employee' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit employee initialization**

```bash
git add backend/internal/handlers/management_employees.go backend/internal/handlers/management_test.go
git commit -m "feat: initialize new employee password setup"
```

### Task 3: Return a one-time setup capability at first login

**Files:**
- Modify: `backend/internal/handlers/employee_auth.go`
- Modify: `backend/internal/handlers/employee_auth_test.go`

**Interfaces:**
- Produces: login JSON `{requires_password_setup: true, setup_token: string}` for flagged accounts
- Produces: `createEmployeePasswordSetupToken(tx *gorm.DB, userID string, now time.Time) (string, error)`

- [ ] **Step 1: Write a failing first-login test**

```go
response := login(flaggedEmployee, phone)
assertStatus(t, response, 200)
assertJSONBool(t, response, "requires_password_setup", true)
assertHexLength(t, response.SetupToken, 64)
assertNoSetCookie(t, response)
assertStoredTokenIsHash(t, db, response.SetupToken)
```

Keep the existing normal-login test and assert it still sets the employee cookie and returns account data.

- [ ] **Step 2: Run the auth test and verify RED**

Run: `go test ./internal/handlers -run 'TestEmployeeAuth.*Setup' -count=1`

Expected: response creates a normal session or omits setup fields.

- [ ] **Step 3: Generate the setup token before normal session creation**

```go
if user.MustChangePassword {
    token, err := createEmployeePasswordSetupToken(tx, user.UserID, time.Now().UTC())
    if err != nil { return err }
    setupToken = token
    return nil
}
sessionCookie, err = createEmployeeSession(tx, user.UserID)
```

After commit, return only the setup outcome for flagged employees and add `Cache-Control: no-store`.

- [ ] **Step 4: Run auth tests and verify GREEN**

Run: `go test ./internal/handlers -run 'TestEmployeeAuth' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit first-login detection**

```bash
git add backend/internal/handlers/employee_auth.go backend/internal/handlers/employee_auth_test.go
git commit -m "feat: issue employee password setup token"
```

### Task 4: Consume the setup token and establish the password

**Files:**
- Create: `backend/internal/handlers/employee_password_setup.go`
- Create: `backend/internal/handlers/employee_password_setup_test.go`
- Modify: `backend/internal/handlers/employee_auth.go`

**Interfaces:**
- Produces: `POST /api/employee/auth/setup-password`
- Consumes header: `X-Employee-Setup-Token`
- Consumes body: `{new_password: string, confirm_password: string}`

- [ ] **Step 1: Write failing endpoint tests**

Cover success, missing/malformed token, expired token, used token, mismatched/weak password, concurrent reuse, and database failure. For success assert:

```go
if stored.MustChangePassword { t.Fatal("setup flag not cleared") }
if bcrypt.CompareHashAndPassword([]byte(stored.PasswordHash), []byte("NewSecure123!")) != nil {
    t.Fatal("new password not stored")
}
if token.UsedAt == nil { t.Fatal("token not consumed") }
```

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `go test ./internal/handlers -run 'TestEmployeePasswordSetup' -count=1`

Expected: route or handler is missing.

- [ ] **Step 3: Implement transactional token consumption**

Use `sha256` on the header token, lock the user then the matching token, require `UsedAt == nil`, `now.Before(ExpiresAt)`, and `user.MustChangePassword`. Reuse `validateNewEmployeePassword`, bcrypt the new password, clear the flag, mark the token used, expire other tokens, delete `employeeSessionAction` rows, and add an audit row with action `ตั้งรหัสผ่านครั้งแรก`.

- [ ] **Step 4: Register the route and verify GREEN**

Run: `go test ./internal/handlers -run 'TestEmployeePasswordSetup|TestEmployeeAuth' -count=1`

Expected: PASS.

- [ ] **Step 5: Commit setup completion**

```bash
git add backend/internal/handlers/employee_password_setup.go backend/internal/handlers/employee_password_setup_test.go backend/internal/handlers/employee_auth.go
git commit -m "feat: complete employee first-login password setup"
```

### Task 5: Add frontend API mapping and setup-token storage

**Files:**
- Modify: `frontend/src/api/employeeAuthApi.ts`
- Modify: `frontend/src/api/employeeAuthApi.test.ts`
- Create: `frontend/src/utils/employeePasswordSetup.ts`
- Create: `frontend/src/utils/employeePasswordSetup.test.ts`

**Interfaces:**
- Produces: `EmployeeLoginResult = {kind:'authenticated'; session:EmployeeSession} | {kind:'password_setup_required'; setupToken:string}`
- Produces: `completePasswordSetup(newPassword: string, confirmPassword: string): Promise<void>`
- Produces: `EMPLOYEE_SETUP_TOKEN_KEY = 'octavia-employee-setup-token-v1'`

- [ ] **Step 1: Write failing API and token tests**

```ts
expect(await employeeAuthApi.login('OCT-EMP-011', '0812345678')).toEqual({
  kind: 'password_setup_required', setupToken: 'a'.repeat(64),
});
expect(sessionStorage.getItem(EMPLOYEE_SETUP_TOKEN_KEY)).toBe('a'.repeat(64));
```

Assert normal login maps to `{kind:'authenticated', session}` and completion sends the header and clears the token only after HTTP success.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm.cmd test -- --run src/api/employeeAuthApi.test.ts src/utils/employeePasswordSetup.test.ts`

Expected: missing discriminated result and setup utility.

- [ ] **Step 3: Implement mapping and setup API**

Branch on `json.requires_password_setup === true`, validate the token as 64 hex characters, store it in `sessionStorage`, and return the setup result. Implement completion against `/api/employee/auth/setup-password` with `X-Employee-Setup-Token`.

- [ ] **Step 4: Run focused frontend tests and verify GREEN**

Run: `npm.cmd test -- --run src/api/employeeAuthApi.test.ts src/utils/employeePasswordSetup.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit frontend API support**

```bash
git add frontend/src/api/employeeAuthApi.ts frontend/src/api/employeeAuthApi.test.ts frontend/src/utils/employeePasswordSetup.ts frontend/src/utils/employeePasswordSetup.test.ts
git commit -m "feat: support employee first-login setup API"
```

### Task 6: Add the forced setup page and login transitions

**Files:**
- Create: `frontend/src/pages/Employee/PasswordSetup/index.tsx`
- Create: `frontend/src/pages/Employee/PasswordSetup/EmployeePasswordSetupPage.test.tsx`
- Modify: `frontend/src/pages/Employee/Login/index.tsx`
- Modify: `frontend/src/pages/Employee/Login/EmployeeLoginPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `EmployeeLoginResult`
- Adds route: `/employee/setup-password`

- [ ] **Step 1: Write failing page and login-flow tests**

Assert a setup-required login does not call `saveEmployeeSession` and navigates to `/employee/setup-password`. Assert the setup page rejects mismatch locally, calls completion for matching valid passwords, and returns to `/employee/login?password_setup=success`. Assert a missing token redirects to employee login with an error marker.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `npm.cmd test -- --run src/pages/Employee/Login/EmployeeLoginPage.test.tsx src/pages/Employee/PasswordSetup/EmployeePasswordSetupPage.test.tsx`

Expected: setup page/route and login-result branch are missing.

- [ ] **Step 3: Implement the password setup page**

Build the form with two password fields, show/hide controls, minimum-eight-character and confirmation checks, disabled loading state, safe API errors, and staff-login styling. On success clear the setup token and navigate to the employee login success URL.

- [ ] **Step 4: Update login branching and route registration**

```ts
const result = await employeeAuthApi.login(username.trim(), password);
if (result.kind === 'password_setup_required') {
  navigate('/employee/setup-password', { replace: true });
  return;
}
saveEmployeeSession(result.session);
navigate('/dashboard', { replace: true });
```

Render a success alert when `password_setup=success` is present.

- [ ] **Step 5: Run focused UI tests and verify GREEN**

Run: `npm.cmd test -- --run src/pages/Employee/Login/EmployeeLoginPage.test.tsx src/pages/Employee/PasswordSetup/EmployeePasswordSetupPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the UI flow**

```bash
git add frontend/src/pages/Employee/PasswordSetup frontend/src/pages/Employee/Login frontend/src/App.tsx
git commit -m "feat: add employee first-login password setup flow"
```

### Task 7: Revoke onboarding tokens on deactivation and verify the system

**Files:**
- Modify: `backend/internal/handlers/management_employees.go`
- Modify: `backend/internal/handlers/management_test.go`
- Modify: `test.md`

**Interfaces:**
- Consumes: `EmployeePasswordSetupToken`
- Produces: deactivation invalidates every unused setup token for that employee

- [ ] **Step 1: Write the failing deactivation test**

Create an unused setup token, deactivate the employee, then assert it can no longer be consumed (delete it or set `UsedAt`/expiry consistently with the handler implementation).

- [ ] **Step 2: Run the focused test and verify RED**

Run: `go test ./internal/handlers -run TestDeleteEmployeeRevokesPasswordSetupTokens -count=1`

Expected: token remains usable.

- [ ] **Step 3: Revoke tokens in the deactivation transaction**

After marking the employee inactive, delete unused `EmployeePasswordSetupToken` rows for the exact user ID before writing the audit event.

- [ ] **Step 4: Update test account documentation**

Document that the ten seeded employees remain ready-to-login demo accounts and do not require first-login setup; newly administrator-created employees use their registered phone as the initial credential.

- [ ] **Step 5: Run complete verification**

Run:

```powershell
cd backend
go test ./...
cd ../frontend
npm.cmd test -- --run
npm.cmd run build
npm.cmd run lint
cd ..
git diff --check
```

Expected: all tests and builds exit 0; lint may report only the repository's pre-existing warnings.

- [ ] **Step 6: Commit integration and documentation**

```bash
git add backend/internal/handlers/management_employees.go backend/internal/handlers/management_test.go test.md
git commit -m "feat: finish employee first-login onboarding"
```
