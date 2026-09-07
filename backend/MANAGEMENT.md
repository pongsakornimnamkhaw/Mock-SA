# PostgreSQL integration: promotions, approvals, history and employees

## Scope

The four menu pages and their existing create/edit/detail routes use `frontend/src/api/managementApi.ts`. Other frontend pages, layouts, routing and API clients are unchanged. The existing server registers `RegisterManagementRoutes` alongside its original modules. No demo data is seeded by the management handlers.

The backend uses its existing `.env` PostgreSQL connection (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE`). Run the existing backend from `backend` with `go run ./cmd/server`, and the frontend from `frontend` with `npm run dev`. The existing Vite `/api` proxy forwards to port 8080. Existing whole-application startup/migration/seed behavior remains unchanged.

## API

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/promotions` | GET, POST | List real data and summary; create a draft and approval request |
| `/api/promotions/options` | GET | Existing concerts and zones, without seeding/modifying them |
| `/api/promotions/:id` | GET, PUT, DELETE | Read, edit/resubmit, soft-delete |
| `/api/promotion-approvals` | GET | Pending and decided requests, including archived promotion history |
| `/api/promotion-approvals/:id` | PATCH | Approve/reject atomically with status and audit changes |
| `/api/employees` | GET, POST | Active staff and actual counts; create employee with permissions |
| `/api/employees/:id` | GET, PUT, DELETE | Read/update staff; deactivate without deleting the user/history |
| `/api/activity-logs?type=staff` | GET | Existing employee activity logs |
| `/api/activity-logs?type=user` | GET | Existing customer activity logs |

Mutations and their audit records share a transaction. Promotion edits require a new approval. Superseded pending requests are retained as rejected with an automatic cancellation explanation; decided requests remain unchanged. Row locks guard simultaneous decisions. Promo codes are case-insensitive and remain reserved after archiving. Unique employee codes and emails are validated. Customer records cannot be modified through employee endpoints.

Banner uploads accept PNG/JPEG/WebP up to 5 MB as data URLs stored in PostgreSQL. Empty edits preserve the existing image; `remove_banner: true` explicitly clears it. Invalid data, blob URLs and SVGs are rejected. Expiry uses the inclusive Bangkok end date; approval timestamp-without-time-zone fields are written as UTC.

## Existing limitations (not expanded into other modules)

- There is no backend sign-in/authentication system. Saved employee permissions are data, **not enforced authorization**. Management endpoints must not be publicly deployed until authenticated server-side authorization is added.
- Audits/approval actors are explicitly unidentified, never inferred from the UI's static profile or a client-supplied employee ID.
- Customer logs, redemption counts and revenue display only what exists in their tables. Booking/payment integrations that populate them are outside this change.
- The existing `zones` model does not identify concert ownership, so selection validates zone existence but cannot enforce a zone-to-concert relationship.
- Legacy promotions with multiple discounts, conditions or quotas can be read; editing returns a conflict instead of silently discarding related rows.

## Optional demo dataset (local development only)

From `backend`, preview with `go run ./cmd/seed-management`, then insert into the
PostgreSQL database in `backend/.env` with:

```powershell
go run ./cmd/seed-management --apply
```

The explicit command adds **10 promotions** (3 active, 2 expired, 3 pending,
2 rejected), **10 approval requests**, **8 employees** (2 admins, 3 editors with
different scopes, 3 read-only), 3 fictional customers, 3 reference zones,
27 simulated redemptions, 26 staff logs and 30 customer logs. All demo IDs start
with `DEMO_MGMT_V1_`, promo/employee codes start with `TEST-MGMT-`, and names or
descriptions include `ทดสอบ`. Emails use the reserved `.test` domain and phone
numbers are dummy values. No login credentials or real authorization are added.

Dates are relative to the first run's Bangkok date. Revenue, discounts and quota
usage match the simulated redemption rows; there are **no actual bookings,
payments, outbound messages or ticket/seat changes**. Existing concerts are only
referenced, never created or changed. Reference zones and customer identities
support the promotion forms and customer-history tab; no other page code changes.

All inserts share a transaction and a seed lock. An existing completion marker
causes subsequent runs to skip **all** writes, preserving edits, approval decisions
and deletions made while testing. ID/code collisions abort the whole batch instead
of overwriting records. This command does not migrate tables and is never invoked
automatically by the server. It requires at least one existing concert and an
already migrated management schema. Do not use it in production: demo totals are
included in management summaries while the demo records remain in the database.

Refresh `/promotions`, `/approvals`, `/history` or `/employees` after insertion.
Use `TEST-MGMT-WAIT25`, `TEST-MGMT-WAIT300` or `TEST-MGMT-WAIT5` to try decisions;
use a rejected promotion to try edit/resubmission, and active/expired promotions
to inspect details, dates, quotas and redemption history.

Verify the seed's relationships, rollback, repeat-run safety and preservation of
edits/deletions in a disposable PostgreSQL schema (public data is not touched):

```powershell
$env:MANAGEMENT_SEED_TEST = '1'
go test ./cmd/seed-management -count=1 -v
```

## Application verification

Frontend: `npm run build` and scoped lint for the seven affected page files plus the API client.

Backend unit/compile checks: `go test ./internal/handlers ./internal/models` and `go test ./... -run '^$'`. Do not run the existing unrelated integration suite against the working database; it contains whole-application migrations/seeds.

Opt-in PostgreSQL tests (PowerShell, from `backend`):

```powershell
$env:MANAGEMENT_INTEGRATION_TEST = '1'
go test ./internal/handlers -run '^TestManagement' -count=1 -v
```

Tests read connection settings from `backend/.env`, create a unique `management_test_<UUID>` schema, run migrations and CRUD tests only there, then drop that test schema. Public application data is not modified. Coverage includes validation, persistent CRUD/permissions/images, customers excluded from staff mutations, duplicate records, concurrent approval conflicts, resubmission history, soft deletion, timestamps and audit transaction rollback.

For optional browser testing, set `MANAGEMENT_BROWSER_TEST=1` as well and run only `TestManagementBrowserFixture` with `-timeout 25m`. It serves the management API on loopback port 8080 with isolated test data. POST to `/__management_test/finish` to stop it and clean up; it also times out after 20 minutes. Never leave this disposable fixture running as the application's backend.
