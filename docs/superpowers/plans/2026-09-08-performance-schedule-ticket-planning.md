# PerformanceSchedule Ticket Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `Showtime` and `TicketCategory` dependencies from ticket planning, use `PerformanceSchedule` for concert rounds, and source zone prices from `Ticket`.

**Architecture:** Keep `Concert` as the planning aggregate root. Reuse the existing `PerformanceSchedule` and `Ticket` tables, store capacity on `Zone`, and preserve `TicketCategory` as an untouched external table. Existing HTTP DTOs remain compatible until the UI rewrite.

**Tech Stack:** Go, Fiber, GORM, PostgreSQL

**Spec:** `docs/superpowers/specs/2026-09-07-ticket-planning-registration-database-design.md`

## Global Constraints

- Work in `D:/Desktop/SA Main v222` as explicitly authorized by the user.
- Do not drop, rename, or reshape `TicketCategory` or `ticket_categories`.
- Do not introduce `Booking` or `Gate-Check-in` into planning handlers.
- Use tests first and verify each expected failure before production changes.

---

### Task 1: Planning schema inventory and migration safety

**Files:** `backend/internal/models/migrate_test.go`, `backend/internal/models/schema_test.go`, `backend/internal/models/migrate.go`, `backend/internal/models/showtime.go`

**Interfaces:** Produce `ticketPlanningTableNames()` without `Showtime` and `TicketCategory`, and a cleanup list that preserves teammate tables.

- [x] Write failing tests expecting `PerformanceSchedule` and rejecting `Showtime`, `TicketCategory`, and `ticket_categories` cleanup.
- [x] Run tests and confirm the old inventory fails.
- [x] Update migration inventory/AutoMigrate and remove the `Showtime` model.
- [x] Run tests and confirm they pass.

### Task 2: Round persistence through PerformanceSchedule

**Files:** `backend/tests/api_test.go`, `backend/internal/handlers/venue_seat.go`, `backend/internal/handlers/concert.go`

**Interfaces:** Map the existing `roundDTO` to `PerformanceSchedule`: ID, order, name, date and doorTime become `ScheduleID`, `PerformanceOrder`, `Details`, `ShowDate` and `StartShow`.

- [x] Change API tests to assert persisted `PerformanceSchedule` and no planning-created `TicketCategory`.
- [x] Run focused tests and confirm failure against the old handler.
- [x] Replace `Showtime` operations with scoped `PerformanceSchedule` operations.
- [x] Stop inserting, updating, or deleting `TicketCategory` in venue planning.
- [x] Remove obsolete model references from concert cleanup.
- [x] Run focused tests and confirm they pass or report PostgreSQL unavailability.

### Task 3: Zone price from Ticket

**Files:** `backend/internal/handlers/report_test.go`, `backend/internal/handlers/report.go`

**Interfaces:** Return the minimum `Ticket.PriceTicket` for tickets whose Seat belongs to the requested Zone; return zero when none exist.

- [x] Write a failing test for ticket-derived zone price without `TicketCategory`.
- [x] Run it and confirm the old query fails.
- [x] Replace the category query with a Ticket/Seat join using `MIN(price_ticket)`.
- [x] Run the focused test and confirm it passes.

### Task 4: Verification

- [x] Run `gofmt` on changed Go files.
- [x] Run `go test ./...` from `backend`.
- [x] Run `go vet ./...` from `backend`.
- [x] Inspect the diff for accidental `TicketCategory`, `Booking`, or `GateCheckIn` schema changes.
- [x] Commit with a scoped message.
