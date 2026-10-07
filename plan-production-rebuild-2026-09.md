# Plan — Production Rebuild of the TODO App (September 2026) · Rev 2

**Goal:** Rebuild the vanilla-JS TODO app as a production-grade product ("Taskflow"):
React + TypeScript frontend, Java Spring Boot backend, localStorage persistence today,
MySQL-compatible everything for a later switch. Aesthetic bar: marketplace apps
(Todoist / TickTick class), not tutorial apps.

**RPI note:** This is the Plan artifact. Research artifact: `architecture--2026-09.md`.
Design artifact: `SPEC.md` (single source of truth for implementation detail — data
model, API, visual tokens). A fresh session should be able to implement from SPEC.md
plus this file alone.

**Rev 2 changelog** (decisions changed by the 3-lens design panel + judge, see SPEC.md
§Final decisions): Zustand replaces Context+useReducer · projects/lists CUT from v1
(tags carry organization; no `listId` anywhere) · sparse BIGINT `position` (gap 1024,
midpoint insert, renormalize) replaces INT reindex · `completedAt` timestamp replaces
`status` enum (done is derived) · priority uppercase `NONE|LOW|MEDIUM|HIGH` ·
localStorage envelope `todo.app.v2` `{schemaVersion:2, tasks, tags}` + theme under
`todo.app.theme` · subtasks schema-ready only (`parent_id`, no UI) · Flyway owns DDL,
`ddl-auto=validate`, Testcontainers MySQL tests, `docker-compose.yml` for local MySQL ·
RFC 9457 errors · import/export endpoints are the local→API data handoff.

---

## 1. Context & non-negotiables

- Legacy app (in `legacy/`, read-only forever) features must all survive: add/edit/
  delete/toggle, priority, due dates with overdue, search, All/Active/Completed
  filters, drag-and-drop reorder, clear-completed, counter, dark mode.
- Legacy localStorage key `todo-app-items` (shape `{id:number, text, done, priority,
  due}`) is migrated on first boot and **never written or deleted** — it is the
  rollback artifact.
- Persistence NOW is browser localStorage; the app runs with zero backend.
- One canonical data model across TS types, stored JSON, DTOs, JPA entities, and
  Flyway DDL. Switching to MySQL later = config flip + JSON import, not a rewrite.
- Single user; no auth UI. `users` table ships now with a seeded row
  (`00000000-0000-0000-0000-000000000001`); `user_id` never appears in DTOs/TS —
  a `CurrentUser` server stub is the future auth seam.
- No Tailwind, no UI kit. Hand-crafted CSS Modules + design tokens (exact hex values
  in SPEC.md §Visual specification). Allowed headless deps: `zustand`, `@dnd-kit/*`.

## 2. Already done (do not redo)

- `legacy/` holds the old app. `SPEC.md` holds the synthesized design.
- `frontend/`: Vite + React 18 + TS scaffold, deps installed.
- `backend/`: Spring Boot **3.5.3** (pinned; Initializr only offers 4.x now — do not
  upgrade), Java 21, Gradle wrapper **8.14.2**, Groovy DSL, package
  `com.chetanwanave.todo`; `./gradlew build` green, deps cached.
- Docker 28.5.1 running (Testcontainers + compose confirmed viable).

## 3. Canonical data model (summary — full detail in SPEC.md)

- Ids: client-minted UUID v4 (`crypto.randomUUID()`), `CHAR(36)` in MySQL, plain
  `String` in JPA. Rationale: ids born offline must survive MySQL import unchanged.
- `Task { id, title(1..500), notes(≤10000)|null, priority: NONE|LOW|MEDIUM|HIGH,
  dueDate 'YYYY-MM-DD'|null, completedAt ISO|null, position BIGINT sparse,
  parentId|null (v1: always null), tagIds[], createdAt, updatedAt }`
- `Tag { id, name(1..50, unique per user case-insensitive), color '#RRGGBB'|null,
  createdAt }`
- Ordering: sparse positions, gap 1024; drop = midpoint of neighbors; renormalize
  whole list to `(i+1)*1024` when any gap < 2; math in `domain/position.ts`, shared
  by both storage modes.
- Tables: `users`, `tasks`, `tags`, `task_tags` — DDL canonical in
  `backend/src/main/resources/db/migration/V1__init.sql`, identical copy at root
  `schema.sql`.
- localStorage: `todo.app.v2` = `{schemaVersion:2, tasks, tags}`; theme =
  `todo.app.theme`.

## 4. Feature scope (final — judge-arbitrated)

**Must-have:** task CRUD (QuickAdd with focus-revealed priority/due/tag row; inline
title edit; delete); animated complete toggle backed by `completedAt`; priorities as
checkbox border tint; due dates with relative labels + overdue red + hand-built
DatePicker; All/Active/Completed filters with counts; debounced search; DnD reorder
(@dnd-kit, keyboard fallback); clear-completed + 5s undo toast (delete too);
localStorage v2 envelope + one-time migration; StorageAdapter interface with
LocalStorageAdapter (active) + ApiAdapter (flag `VITE_STORAGE_MODE=api`), optimistic
updates with snapshot rollback; light/dark/system theme, pre-paint script, full dual
token set; full Spring Boot REST backend (contract in SPEC.md); polish pass (empty
states per filter, focus rings, hover-revealed actions, tabular-nums, favicon).

**Should-have (also being built):** tags end-to-end; notes + task edit popover;
keyboard shortcuts (`N`, `/`, arrows, `E`, `D`, `Backspace`, `0-3`, `Alt+Arrow`);
JSON import/export (UI + endpoints); multi-tab reconcile via `storage` event.

**Cut from v1:** projects/lists + smart views, quick-add token parsing, Cmd+K
palette, subtasks UI, reminders/recurring/collab/stats, optimistic locking.

## 5. REST API contract

Full contract in SPEC.md §REST API contract. Shape: `/api/v1`, camelCase JSON,
RFC 9457 `application/problem+json` with `errors[{field,message}]`; PATCH partial
updates with tri-state semantics (JsonNullable server-side); `completed: boolean` in,
`completedAt` out; `PUT /tasks/positions` transactional batch; `POST
/tasks/clear-completed → {deletedIds}`; `GET /export` / `POST /import`
(upsert-by-id) — the local→API handoff; `GET /health`. 400/404/409, no 422;
DELETE idempotent. CORS: `http://localhost:5173`.

## 6. Files (ownership map used by the parallel builders)

- **Frontend builder owns `frontend/`** — layout per SPEC.md §Frontend architecture:
  `app/` (App, AppProviders, ErrorBoundary, ToastHost), `domain/` (types, validation,
  position, dates, priority), `storage/` (StorageAdapter, LocalStorageAdapter,
  ApiAdapter, migration, createAdapter), `store/` (useAppStore, selectors, undo),
  `features/tasks|filters|theme/`, `components/` (Button, IconButton, Popover, Toast,
  Kbd, DatePicker, EmptyState, TagChip), `styles/tokens.css + base.css`, `lib/`,
  `test/` (adapter contract suite ×2, migration, position). Deps: zustand, @dnd-kit/*;
  dev: vitest, RTL, MSW.
- **Backend builder owns `backend/`** + root `schema.sql` + root `docker-compose.yml`
  — packages `controller/ service/ repository/ entity/ dto/ mapper/ exception/
  config/` per SPEC.md §Backend architecture; Flyway `V1__init.sql`;
  `ddl-auto=validate`; UTC; Testcontainers MySQL tests; springdoc.
- **After builds (docs pass):** rewrite root `CLAUDE.md` (new architecture, run
  commands, adapter-flip procedure, keep the stay-inside-TODO restriction) + new
  root `README.md`.

## 7. Execution order

1. ✅ Design workflow (3 lenses + judge) → `SPEC.md`.
2. ▶ Build workflow: frontend + backend builders in parallel (disjoint ownership),
   each iterating until its own build/tests are green.
3. Verify workflow (independent agents): clean rebuilds; feature audit vs §4;
   code review (no `dangerouslySetInnerHTML`; quota-error handling; a11y basics);
   contract-parity review (TS ≡ DTO ≡ entity ≡ DDL ≡ SPEC, column-by-column);
   light+dark screenshots at 1440px/390px via headless Chrome.
4. Fix round for findings; then docs (`CLAUDE.md`, `README.md`).

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Spring Boot 4 drift | Pinned 3.5.3 + Gradle 8.14.2; builders instructed not to bump. |
| Migration corrupts user data | Legacy key never written; run-once gate on `todo.app.v2` existence; corrupt-input fixtures unit-tested; corrupt v2 preserved to `todo.app.v2.corrupt`. |
| Schema drift across layers | Flyway is canonical + `ddl-auto=validate` + Testcontainers (real MySQL CHECKs/collations) + exact-JSON serialization test + verify-round column-by-column diff. |
| DnD jank / a11y | @dnd-kit pointer+keyboard sensors; positions math unit-tested. |
| localStorage quota | All writes through the adapter; failures surface as error toasts via `RepositoryError` (legacy app failed silently). |
| "Bootcamp look" | SPEC.md visual tokens are exact (hex, motion, spacing); screenshot gate in verify round; premium checklist in SPEC.md is acceptance criteria. |
| Parallel-builder collisions | Disjoint directory ownership (map in §6); root files assigned to exactly one builder. |
| Scope creep | §4 cut list is judge-final for v1. |

## 9. Success criteria (all testable)

1. `cd frontend && npm run build` → exit 0; `npm run test` → all green (adapter
   contract suite passes against BOTH adapters).
2. `cd backend && ./gradlew build` → exit 0 on Testcontainers MySQL (validation 400
   with `errors[]`, 404, 409 duplicate-id and duplicate-tag-name, idempotent DELETE,
   positions-batch rollback, clear-completed ids, import upsert, exact-JSON
   TaskResponse test).
3. Smoke: `docker compose up -d` + `./gradlew bootRun` → `GET /api/v1/health` 200;
   `POST /api/v1/tasks {"id":"<uuid>","title":"smoke"}` → 201 + Location + same id;
   `PATCH {"completed":true}` → `completedAt` stamped; `DELETE` ×2 → 204 both;
   empty-title POST → 400 problem+json.
4. Migration proof (browser console): set
   `localStorage['todo-app-items']='[{"id":1,"text":"old","done":false,"priority":"high","due":"2026-01-01"}]'`,
   remove `todo.app.v2`, reload → "old" appears with HIGH tint + overdue label;
   `todo-app-items` still present; `todo.app.v2` parses with `schemaVersion:2`.
5. Feature walkthrough of every §4 must-have + should-have in `npm run dev`.
6. Headless-Chrome screenshots light + dark at 1440px and 390px match SPEC.md visual
   spec (no unstyled elements, no overflow).
7. Flip test: `VITE_STORAGE_MODE=api` with backend up → CRUD/reorder/clear round-trip
   over REST; `POST /import` of the exported envelope reports correct counts.
8. `CLAUDE.md` describes the new architecture accurately enough that a fresh session
   can run both apps from it alone.

## 10. Out of scope for v1

Auth, deployment/CI, projects/lists, recurring tasks, reminders, subtasks UI,
optimistic locking. MySQL switch procedure (README headline): `docker compose up -d`
→ run backend (`Flyway` applies schema + seed) → export from local UI (or ApiAdapter
auto-offers import when the server is empty) → set `VITE_STORAGE_MODE=api` → verify
counts + CRUD + both themes; local `todo.app.v2` stays as backup.
