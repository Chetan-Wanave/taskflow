# SPEC.md — Taskflow (production rebuild of the TODO app)

Generated 2026-09-06 by a 3-lens design panel (product / engineering / visual) + judge synthesis.
This is the single source of truth for both builders. Where this file and
plan-production-rebuild-2026-09.md conflict, THIS FILE WINS (the plan predates synthesis).
Toolchain facts (already scaffolded, do not change): frontend = Vite + React 18 + TS strict;
backend = Spring Boot 3.5.3 (pinned — do NOT upgrade to 4.x), Java 21, Gradle wrapper 8.14.2,
Groovy build.gradle (spec text mentioning 3.3.x / Kotlin DSL is superseded by this note).

## Final decisions (judge arbitration)

- **ID strategy** — Client-generated UUIDv4 via crypto.randomUUID(), lowercase 36-char string in every layer; MySQL CHAR(36); JPA entities use plain String ids.
  - *Why:* All three lenses require client minting (localStorage-first, lossless future import, idempotent POST). CHAR(36) (P1+P3) beats P2's BINARY(16): readable queries, zero Hibernate converter friction, and index-size savings are irrelevant at single-user scale.
- **Ordering strategy** — Sparse BIGINT position, gap 1024, midpoint on drop, renormalize the whole list to (i+1)*1024 when a gap closes below 2. Position math lives in frontend domain/position.ts and runs identically in both storage modes; reorder is a batch write (PUT /tasks/positions).
  - *Why:* P3+P1 majority. P2's fractional string keys need a vendored algorithm plus a mandatory ascii_bin collation (a silent-corruption footgun P2 itself flags). Integer midpoints are boring, portable, and the rare renormalize is just the same batch endpoint. Client-owned math (not P1's server-owned /move) keeps LocalStorageAdapter and ApiAdapter semantics literally the same code path.
- **State management** — Zustand, with all mutation logic as pure functions in domain/ that store actions apply.
  - *Why:* P1+P2 majority. Per-selector subscriptions keep 60fps drag/animation without memo-walls; the store is callable from non-React modules (undo timer, keyboard handler). Context+useReducer (P3) re-renders every consumer per keystroke; RTK is ceremony for one aggregate. Pure domain functions preserve the reducer-discipline learning value.
- **Projects / Inbox / Today / Upcoming views** — CUT entirely from v1 (overrules P1's must-have). No projects table, no project_id column now.
  - *Why:* Projects double the data model (second positioned entity, cascade rules, sidebar CRUD, per-project views) and are not legacy parity — unshippable by two builders in one pass. Tags deliver organization at a fraction of the cost. Adding projects later is purely additive (new table + nullable tasks.project_id + backfill), documented in the migration plan.
- **Quick-add token parsing and Cmd+K palette** — CUT from v1. QuickAdd ships as a plain input whose second row (priority segmented control, due picker, tags) appears on focus.
  - *Why:* P1's parser and P3's palette are each multi-day pure-frontend features that jeopardize the polish pass; both are additive later with zero model impact. P2's collapsed composer covers capture cleanly.
- **Subtasks** — Schema-ready only: tasks.parent_id CHAR(36) NULL FK ships in DDL, Task.parentId ships in TS/DTO (always null in v1). No UI, no service logic beyond FK cascade.
  - *Why:* P2/P3 majority — the classic scope trap. Carrying the column and field now guarantees no breaking migration or JSON-shape change when the checklist UI is added.
- **Completion model** — completed_at DATETIME(3) NULL replaces the boolean; PATCH accepts intent as completed: boolean and the adapter/server derives the timestamp; responses carry completedAt only; UI derives done = completedAt !== null.
  - *Why:* Unanimous on the timestamp (richer, powers future stats). Boolean-in/timestamp-out keeps clients from minting server timestamps in API mode while keeping the toggle a one-field PATCH.
- **Priority enum** — 'NONE'|'LOW'|'MEDIUM'|'HIGH' uppercase strings end-to-end; MySQL VARCHAR(10) + CHECK; @Enumerated(STRING). Default NONE. Migration uppercases legacy values, anything unrecognized → NONE.
  - *Why:* Uppercase matches the Java enum so there is zero mapping code (P1's lowercase+TINYINT needs two translation layers). NONE (P3) gives new tasks an honest neutral state and the checkbox tint a resting color. VARCHAR+CHECK over MySQL ENUM: evolves without ALTER pain.
- **localStorage key + migration posture** — New key 'todo.app.v2' holding a versioned envelope {schemaVersion:2, tasks, tags}. Legacy 'todo-app-items' is NEVER written or deleted. Theme lives under its own key 'todo.app.theme'.
  - *Why:* P1+P2 majority. P3's reuse-the-same-key mutates the only rollback artifact; a migration that can touch legacy data is the one unforgivable failure class. Version gate makes the migration run-once by construction.
- **Drag-and-drop** — @dnd-kit/core + @dnd-kit/sortable (headless), pointer + keyboard sensors; P3's lift styling (scale 1.02, shadow-2) applied through dnd-kit transforms.
  - *Why:* P1+P2 majority, and hand-rolled DnD is P3's own top-listed risk. Headless utilities do not violate the no-UI-kit constraint; keyboard sortable gives the accessibility story for free.
- **Optimistic locking (version column)** — CUT. No version column; multi-tab safety comes from LocalStorageAdapter listening to the 'storage' event and re-reading the envelope.
  - *Why:* P2's 409-stale flow would ripple through the store rollback, both adapters, and the backend for a single-user app. Additive later (one BIGINT + @Version).
- **Schema ownership + dev database** — Flyway V1__init.sql is canonical (identical copy checked in at repo root as schema.sql); hibernate ddl-auto=validate; MySQL 8.4 via docker-compose; integration tests on Testcontainers MySQL, not H2.
  - *Why:* Merges P1's validate rule with P2's Flyway/Testcontainers rigor. H2 silently diverges on CHECK constraints and collations; letting Hibernate generate DDL guarantees drift from the checked-in schema.
- **Error contract + HTTP conventions** — RFC 9457 application/problem+json with an errors:[{field,message}] array; 400 = validation, 404 = unknown id on GET/PATCH, 409 = business conflict (duplicate id, duplicate tag name); no 422. DELETE is idempotent (204 even when missing). PATCH not PUT for updates.
  - *Why:* P2's conventions align with Spring's default @Valid behavior and simplify undo/retry races on the optimistic client; P1's 422 adds a distinction the builders don't need.
- **Naming** — Tables: users, tasks, tags, task_tags. Base package com.chetanwanave.todo. Frontend flags: VITE_STORAGE_MODE=local|api, VITE_API_BASE_URL.
  - *Why:* 'tasks' (P1+P3) over 'todos'; one canonical set of names prevents the two builders inventing different ones.
- **Users table** — Ship now, seeded row id '00000000-0000-0000-0000-000000000001' (display_name 'Local User'); user_id NOT NULL FK on tasks and tags; userId never appears in DTOs or TS types — a CurrentUser stub component resolves it server-side.
  - *Why:* Unanimous. Adding user_id later re-keys every table and index; the stub is the exact seam where Spring Security plugs in with zero contract change.
- **Visual direction** — Adopt P3's system wholesale (exact hex tokens both themes, motion tokens, checkbox signature, 240px sidebar + 640px column). No slide-in detail panel (P1); editing metadata happens in P3's task edit popover. No MapStruct; hand-written mappers.
  - *Why:* P3 is the only proposal concrete enough to build from without taste decisions. The popover is far cheaper than a third layout zone and keeps the list calm; hand-written mappers are explicit interview material (P1+P3).
- **Import/export** — Keep as should-have: GET /export, POST /import (upsert-by-id), matching exportData/importData on the adapter interface, small UI entry in the sidebar footer.
  - *Why:* Half a day of work, the only safety valve for localStorage users, and it IS the local→API data handoff at flip time — three proposals wanted it in some form.

## Feature set

- **[must-have]** Task CRUD: QuickAdd input (focus reveals priority/due/tag row), inline title edit (double-click or E; Enter commits, Esc cancels), delete — Legacy parity; inline edit must feel instant (optimistic).
- **[must-have]** Animated complete toggle backed by completedAt timestamp — The signature moment: SVG stroke-draw check, strikethrough sweep, counter tick (spec in visualSpec).
- **[must-have]** Priority NONE/LOW/MEDIUM/HIGH shown as checkbox border tint + flag in edit popover — Legacy parity; color never the only signal (label on hover/popover).
- **[must-have]** Due dates (date-only) with relative labels (Today/Tomorrow/Fri/Sep 12), overdue in danger red; hand-built month-grid DatePicker — Never native <input type=date>; string compare against local 'today' — no Date('YYYY-MM-DD') parsing anywhere.
- **[must-have]** All/Active/Completed filters with live counts, debounced client-side text search, remaining counter — Filter + search are view-state in the store, never persisted.
- **[must-have]** Drag-and-drop reorder via @dnd-kit with keyboard fallback, persisted sparse BIGINT positions — Drop = midpoint; renormalize batch when gap < 2. Both adapters implement identical math from domain/position.ts.
- **[must-have]** Clear completed + 5s undo toast for delete and clear-completed — Undo re-creates via normal createTask with original id+position (client UUIDs make this idempotent). No confirm dialogs.
- **[must-have]** localStorage persistence: 'todo.app.v2' versioned envelope + one-time v1→v2 migration; legacy key untouched — Exact algorithm in migrationPlan; migration unit-tested against malformed inputs.
- **[must-have]** StorageAdapter interface with LocalStorageAdapter (active) + ApiAdapter (VITE_STORAGE_MODE=api), optimistic updates with snapshot rollback + error toasts, shared Vitest contract suite (ApiAdapter via MSW) — The architectural centerpiece; contract suite is what keeps the dormant adapter honest.
- **[must-have]** Theme light/dark/system: data-theme attribute, persisted, pre-paint inline head script (no flash), full dual token set — Dark palette hand-tuned, not inverted.
- **[must-have]** Spring Boot backend implementing the full REST contract: layered controller/service/repository/entity/DTO, Flyway V1__init.sql + root schema.sql, seeded user, CORS, RFC 9457 errors — Dormant in v1 runtime but complete and integration-tested (Testcontainers MySQL).
- **[must-have]** Polish pass as scheduled work: empty states per filter, :focus-visible rings, hover-revealed row actions, tabular-nums, favicon + title — The premium read is a deliverable, not leftover time.
- **[should-have]** Tags: many-to-many, #name chips on rows, sidebar tag filters, managed in edit popover — Schema/DTO/adapter carry tags from day one regardless; only the UI is should-have.
- **[should-have]** Notes field + task edit popover consolidation (due picker, priority segmented control, tags, notes) — One nullable TEXT column; popover is the single crafted editing surface.
- **[should-have]** Keyboard shortcuts + roving list focus: N new, / search, ArrowUp/Down navigate, E edit, D toggle done, Backspace delete, 0/1/2/3 priority, Alt+Arrow reorder — Centralized in lib/keyboard.ts; kbd hint chips in tooltips.
- **[should-have]** JSON import/export (adapter methods + /export /import endpoints + small sidebar entry) — Safety valve for localStorage users and the local→API handoff.
- **[should-have]** Multi-tab reconcile via 'storage' event — LocalStorageAdapter notifies store to re-read the envelope; prevents last-writer-wins loss.
- **[cut]** Projects/lists, Inbox, Today/Upcoming smart views — Doubles the model and UI; additive later (new table + nullable project_id).
- **[cut]** Quick-add natural-language/token parsing ('tomorrow', p1, #tag) — Edge-case pit; additive pure-frontend later.
- **[cut]** Cmd+K command palette — Post-v1 polish; ~200 lines but competes with the polish pass.
- **[cut]** Subtasks UI — parent_id column + parentId field ship now; checklist UI later, one level max.
- **[cut]** Reminders, recurring tasks, collaboration, calendar/kanban views, stats dashboard — P1's kill list adopted verbatim; half-working versions read as broken.
- **[cut]** Optimistic locking (version column, 409 stale) — Single-user; additive later with @Version.

## Canonical data model

Canonical domain model — every layer (TS types, localStorage JSON, REST DTOs, JPA entities, MySQL DDL) describes exactly this, camelCase in JSON/TS, snake_case in SQL.

TypeScript (frontend/src/domain/types.ts):

export type Priority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: string;                 // UUIDv4, client-generated (crypto.randomUUID())
  title: string;              // 1..500 after trim
  notes: string | null;       // <= 10000
  priority: Priority;         // default 'NONE'
  dueDate: string | null;     // 'YYYY-MM-DD', date-only, NEVER a Date object
  completedAt: string | null; // ISO-8601 UTC ms; null = active
  position: number;           // sparse gap 1024; integer > 0
  parentId: string | null;    // always null in v1 UI (subtask-ready)
  tagIds: string[];
  createdAt: string;          // ISO-8601 UTC ms
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;               // 1..50, unique per user case-insensitive
  color: string | null;       // '#RRGGBB' or null (default neutral chip)
  createdAt: string;
}

export interface AppData { schemaVersion: 2; tasks: Task[]; tags: Tag[]; }

localStorage layout: key 'todo.app.v2' = JSON.stringify(AppData). Theme key 'todo.app.theme' = 'light'|'dark'|'system'. Legacy key 'todo-app-items' is read-only forever.

Field mapping TS↔SQL: id↔id, title↔title, notes↔notes, priority↔priority, dueDate↔due_date (DATE), completedAt↔completed_at (DATETIME(3) UTC), position↔position (BIGINT), parentId↔parent_id, createdAt/updatedAt↔created_at/updated_at (DATETIME(3) UTC), tagIds↔task_tags join rows. user_id exists ONLY in SQL/JPA (resolved server-side); it never appears in DTOs or TS.

Ordering: tasks ordered by position ASC within user. New task appends max(position)+1024 (first = 1024). Drop between neighbors = floor((prev+next)/2); drop at top = floor(first/2); if any resulting gap < 2, renormalize the full visible list to (index+1)*1024 and persist as one batch (reorderTasks / PUT /tasks/positions). Same function used by both adapters (domain/position.ts).

Completion: done is derived (completedAt !== null). Toggling sends completed:boolean; the executing side (LocalStorageAdapter locally, server in API mode) stamps completedAt = now UTC or null.

Tags: proper join table (indexable filtering), serialized outward as tagIds: string[]. Deleting a tag cascades join rows only. Subtasks: adjacency via nullable parent_id, ON DELETE CASCADE; one-level rule reserved for the future service layer (parent must have parent_id NULL) — no v1 UI.

Validation (same rules at three enforcement points — domain/validation.ts used by composer AND both adapters; Jakarta annotations on request DTOs; DB CHECK/UNIQUE as last line): title required 1–500 after trim; notes ≤ 10000; priority in enum; dueDate matches ^\\d{4}-\\d{2}-\\d{2}$ and is a real calendar date; position integer ≥ 1; tag name 1–50, unique per user case-insensitively; color matches ^#[0-9A-Fa-f]{6}$ when present; tagIds must reference existing tags; parentId must be null or reference a task with parent_id NULL.

## MySQL schema (canonical DDL)

```sql
-- Canonical schema. Lives at backend/src/main/resources/db/migration/V1__init.sql
-- and as an identical checked-in copy at repo root: TODO/schema.sql
-- MySQL 8.x, InnoDB, utf8mb4.

CREATE TABLE users (
  id           CHAR(36)     NOT NULL,
  email        VARCHAR(255) NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tasks (
  id           CHAR(36)     NOT NULL,
  user_id      CHAR(36)     NOT NULL,
  parent_id    CHAR(36)     NULL,
  title        VARCHAR(500) NOT NULL,
  notes        TEXT         NULL,
  priority     VARCHAR(10)  NOT NULL DEFAULT 'NONE',
  due_date     DATE         NULL,
  completed_at DATETIME(3)  NULL,
  position     BIGINT       NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_tasks_user     FOREIGN KEY (user_id)   REFERENCES users(id),
  CONSTRAINT fk_tasks_parent   FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT chk_tasks_priority CHECK (priority IN ('NONE','LOW','MEDIUM','HIGH')),
  KEY idx_tasks_user_position  (user_id, position),
  KEY idx_tasks_user_due       (user_id, due_date),
  KEY idx_tasks_user_completed (user_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE tags (
  id         CHAR(36)    NOT NULL,
  user_id    CHAR(36)    NOT NULL,
  name       VARCHAR(50) NOT NULL,
  color      CHAR(7)     NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_tags_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_tags_user_name (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_tags (
  task_id CHAR(36) NOT NULL,
  tag_id  CHAR(36) NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_tags_tag  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'Local User');

-- Notes: tag-name case-insensitive uniqueness is satisfied by utf8mb4_0900_ai_ci on uq_tags_user_name.
-- All DATETIME(3) values are UTC (hibernate.jdbc.time_zone=UTC). due_date is DATE on purpose — never DATETIME.
-- Future (documented, NOT in V1): projects table + tasks.project_id; version BIGINT for optimistic locking.
```

## REST API contract

Base /api/v1 · JSON camelCase · ids are UUID strings · timestamps ISO-8601 UTC with ms · dueDate 'YYYY-MM-DD' · no auth (server binds the seeded user; a token header is additive later) · no pagination in v1 (?limit/?cursor reserved).

Errors: RFC 9457 application/problem+json
{ "type": "about:blank", "title": "Validation failed", "status": 400, "detail": "...", "errors": [{ "field": "title", "message": "must not be blank" }] }
400 = validation/malformed JSON · 404 = unknown id (GET/PATCH) · 409 = conflict (duplicate client id, duplicate tag name). No 422. DELETE is idempotent (204 even if already gone).

TaskResponse (used everywhere a task is returned):
{ "id": "uuid", "title": "Ship design tokens", "notes": null, "priority": "NONE|LOW|MEDIUM|HIGH", "dueDate": "2026-09-08"|null, "completedAt": "2026-09-06T09:00:00.000Z"|null, "position": 1024, "parentId": null, "tagIds": ["uuid"], "createdAt": "...", "updatedAt": "..." }
TagResponse: { "id": "uuid", "name": "work", "color": "#5B5BD6"|null, "createdAt": "..." }

TASKS
GET    /api/v1/tasks?status=all|active|completed&search=&tagId=  → 200 TaskResponse[] ordered by position ASC (params optional, combinable; default status=all)
POST   /api/v1/tasks   { "id"?: uuid (client-generated accepted; server mints if absent), "title": req, "notes"?, "priority"? (default NONE), "dueDate"?, "position"? (server appends max+1024 if absent), "parentId"?: null, "tagIds"?: [] }  → 201 + Location: /api/v1/tasks/{id} + TaskResponse · 409 if id exists
GET    /api/v1/tasks/{id}  → 200 TaskResponse · 404
PATCH  /api/v1/tasks/{id}  body: any subset of { "title", "notes", "priority", "dueDate", "completed": boolean, "position", "tagIds" } — absent = unchanged; explicit null clears notes/dueDate; completed:true sets completedAt=now UTC server-side, false nulls it  → 200 TaskResponse · 404 · 400
DELETE /api/v1/tasks/{id}  → 204 (idempotent)
PUT    /api/v1/tasks/positions   { "positions": [{ "id": uuid, "position": 1024 }, ...] }  → 204 (transactional batch; any unknown id → 404, whole batch rolled back; used for DnD writes and renormalization)
POST   /api/v1/tasks/clear-completed  → 200 { "deletedIds": [uuid, ...] } (feeds the undo toast)

TAGS
GET    /api/v1/tags  → 200 TagResponse[]
POST   /api/v1/tags   { "id"?: uuid, "name": "1..50", "color"?: "#RRGGBB" }  → 201 TagResponse · 409 duplicate name (case-insensitive per user)
PATCH  /api/v1/tags/{id}   { "name"?, "color"? }  → 200 TagResponse · 404 · 409
DELETE /api/v1/tags/{id}  → 204 (task_tags rows cascade; tasks keep other tags)

DATA
GET    /api/v1/export  → 200 { "schemaVersion": 2, "tasks": [...], "tags": [...] }  (identical shape to the localStorage envelope)
POST   /api/v1/import   { "schemaVersion": 2, "tasks": [...], "tags": [...] }  → 200 { "importedTasks": n, "importedTags": m, "skippedExisting": k } — transactional upsert-by-id; this is the local→API flip handoff
GET    /api/v1/health  → 200 { "status": "ok" }  (ApiAdapter.init pings this and fails fast with a readable toast)

Adapter↔endpoint mapping (the StorageAdapter interface exists so this is 1:1): init→GET /health · load→parallel GET /tasks + GET /tasks? no — GET /tasks (status=all) + GET /tags · createTask→POST /tasks (always sends client id) · updateTask→PATCH /tasks/{id} · deleteTask→DELETE /tasks/{id} · reorderTasks→PUT /tasks/positions · clearCompleted→POST /tasks/clear-completed · exportData→GET /export · importData→POST /import.

## Frontend architecture

Monorepo: TODO/{frontend, backend, legacy, schema.sql, docker-compose.yml, README.md, CLAUDE.md}.

STACK: React 18 + Vite + TypeScript strict. CSS Modules per component + one global styles/tokens.css and styles/base.css. Runtime deps ONLY: react, react-dom, zustand, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities. Dev: vitest, @testing-library/react, msw. Env: VITE_STORAGE_MODE='local'|'api' (default 'local'), VITE_API_BASE_URL (default 'http://localhost:8080/api/v1').

frontend/src/
  app/            App.tsx, AppProviders.tsx, ErrorBoundary.tsx, ToastHost.tsx
  domain/         types.ts, validation.ts, position.ts (sparse-gap + renormalize math), dates.ts (todayLocal(), relative labels, overdue compare — string-based, NEVER new Date('YYYY-MM-DD')), priority.ts
  storage/        StorageAdapter.ts (interface), LocalStorageAdapter.ts, ApiAdapter.ts, migration.ts (v1→v2), createAdapter.ts (factory reads import.meta.env)
  store/          useAppStore.ts (Zustand), selectors.ts (visibleTasks, counts, overdue set), undo.ts (5s stack for delete/clear-completed)
  features/tasks/     TaskList.tsx, TaskRow.tsx, Checkbox.tsx, QuickAdd.tsx, TaskEditPopover.tsx (+ .module.css each)
  features/filters/   Sidebar.tsx, FilterTabs.tsx (mobile <880px)
  features/theme/     ThemeToggle.tsx, useTheme.ts
  components/     Button, IconButton, Popover, Toast, Kbd, DatePicker (hand-built month grid), EmptyState, TagChip
  styles/         tokens.css, base.css
  lib/            keyboard.ts (single keymap), classnames.ts
  test/           adapterContract.test.ts (shared suite run against BOTH adapters — LocalStorageAdapter directly, ApiAdapter over MSW), migration.test.ts, position.test.ts

STORAGE ADAPTER (storage/StorageAdapter.ts — verbatim):

export type TaskPatch = Partial<Pick<Task,'title'|'notes'|'priority'|'dueDate'|'position'|'tagIds'>> & { completed?: boolean };
export interface StorageAdapter {
  init(): Promise<void>;                                      // local: run migration; api: GET /health
  load(): Promise<AppData>;
  createTask(task: Task): Promise<Task>;                      // client supplies full row incl. id + position
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  reorderTasks(positions: { id: string; position: number }[]): Promise<void>;
  clearCompleted(): Promise<string[]>;                        // deleted ids
  createTag(tag: Tag): Promise<Tag>;
  updateTag(id: string, patch: Partial<Pick<Tag,'name'|'color'>>): Promise<Tag>;
  deleteTag(id: string): Promise<void>;
  exportData(): Promise<AppData>;
  importData(data: AppData): Promise<void>;
}

LocalStorageAdapter: reads/writes the 'todo.app.v2' envelope synchronously wrapped in Promise.resolve; validates via domain/validation.ts (local path exercises the same rules the server enforces); subscribes to window 'storage' events and notifies the store to re-read (multi-tab reconcile). ApiAdapter: thin fetch client per the contract; maps problem+json to RepositoryError { kind: 'validation'|'conflict'|'not_found'|'network'|'server'; fieldErrors? }.

STATE (Zustand): one store holding { tasks, tags, filter: 'all'|'active'|'completed', search, selectedTaskId, editingTaskId, theme, toasts }. Every mutation: (1) snapshot the affected entities, (2) apply pure domain function synchronously (optimistic), (3) await adapter, (4) on rejection restore snapshot + push error toast. Derivations (visible list sorted by position, counts, overdue) live in selectors.ts; components subscribe via selectors so a search keystroke re-renders only the list wrapper. undo.ts holds deleted Task rows for 5s; undo replays createTask with the original id/position (idempotent thanks to client UUIDs). Search/filter/edit state is never persisted.

DnD: @dnd-kit sortable list; onDragEnd computes midpoint via domain/position.ts, optimistic position update, adapter.updateTask(id,{position}) — or reorderTasks batch when renormalization triggered (gap < 2).

THEME: inline <script> in index.html head reads 'todo.app.theme' and sets data-theme on <html> before first paint; 'system' = no attribute, dark tokens supplied by @media (prefers-color-scheme: dark) { :root:not([data-theme]) } block; color-scheme: light dark on :root.

Boot: createAdapter() → adapter.init() → adapter.load() → store.hydrate(). ErrorBoundary + quota errors surface through the same RepositoryError path.

## Backend architecture

TODO/backend — Java 21, Spring Boot 3.3.x, Gradle wrapper (Kotlin DSL). Dependencies: spring-boot-starter-web, spring-boot-starter-data-jpa, spring-boot-starter-validation, flyway-mysql, mysql-connector-j, springdoc-openapi-starter-webmvc-ui, spring-boot-starter-test, testcontainers (mysql, junit-jupiter).

Package com.chetanwanave.todo:
  controller/   TaskController, TagController, DataController (export/import), HealthController — HTTP only, @Valid, no business logic
  service/      TaskService, TagService, ImportExportService — @Transactional; owns: position append (max+1024), batch reorder, clear-completed, completed→completedAt stamping, tagIds resolution, duplicate-id → DuplicateIdException, upsert import
  repository/   TaskRepository, TagRepository, UserRepository extends JpaRepository<Entity, String> (derived queries + @Query for status/search/tag filters)
  entity/       UserEntity, TaskEntity, TagEntity — String ids (@Id, CHAR(36), no converters), Priority enum @Enumerated(EnumType.STRING), LocalDate dueDate, Instant completedAt/createdAt/updatedAt (@PrePersist/@PreUpdate stamp them — app is authoritative, DB defaults are backstop), TaskEntity @ManyToMany(fetch = LAZY) @JoinTable(name = "task_tags") Set<TagEntity> tags
  dto/          Java records: TaskResponse, CreateTaskRequest, UpdateTaskRequest, ReorderRequest, ClearCompletedResponse, TagResponse, CreateTagRequest, UpdateTagRequest, ImportRequest, ImportResult, ExportResponse — Jakarta annotations (@NotBlank, @Size(max=500), @Pattern for color/dueDate)
  mapper/       TaskMapper, TagMapper — hand-written entity↔DTO (no MapStruct)
  exception/    NotFoundException, DuplicateIdException, DuplicateNameException + GlobalExceptionHandler (@RestControllerAdvice) emitting RFC 9457 problem+json with errors[] built from MethodArgumentNotValidException
  config/       CorsConfig (allow http://localhost:5173, all methods), CurrentUser stub (@Component returning the seeded UUID constant — the auth seam), OpenApiConfig

Persistence rules: Flyway owns the schema (V1__init.sql = root schema.sql verbatim, includes the user seed). spring.jpa.hibernate.ddl-auto=validate — Hibernate NEVER generates DDL. spring.jpa.properties.hibernate.jdbc.time_zone=UTC. UpdateTaskRequest models tri-state fields (absent vs null vs value) with JsonNullable or a Map-backed patch — pick JsonNullable (openapi-friendly); explicit null clears notes/dueDate; completed boolean drives completedAt.

Semantics mirrored from the frontend domain (contract parity): position math identical to domain/position.ts; DELETE idempotent 204; clear-completed returns deleted ids; import upserts by id transactionally, skipping unchanged existing ids.

Run: docker-compose.yml at repo root starts mysql:8.4 (db 'todo', user/password from .env defaults); ./gradlew bootRun on port 8080. Tests: @SpringBootTest + MockMvc against Testcontainers MySQL (real CHECK constraints, real collation) — includes one serialization test asserting the exact sample TaskResponse JSON from this spec so DTOs can't drift from the TS types. springdoc serves /swagger-ui as living docs.

README headline: the adapter flip (set VITE_STORAGE_MODE=api, docker compose up, ./gradlew bootRun, POST /import with the exported envelope).

## Visual specification

LAYOUT. Desktop: fixed 240px sidebar (app wordmark top — text-only, lowercase, tight tracking; All/Active/Completed nav with count pills; Tags section; import/export + three-state theme toggle pinned bottom) + centered content column max-width 640px, 48px top padding. Content: date header ('Saturday, Sep 6', 20px/600), QuickAdd bar (borderless input; priority segmented control + due field + tag picker revealed only while focused), task list, footer line (remaining count + Clear completed quiet text button). Rows sit directly on the app background — NO card-per-item; a row gains --bg-subtle on hover, min-height 44px, padding 10px 12px, 2px row gap, 32px between sections. Below 880px: sidebar collapses to a FilterTabs segmented row under the header. Popover (task edit) 320px, radius-lg, shadow-3. Zero layout shift: reserve space for badges and meta lines.

SPACING: 4px base scale, tokens --space-1..--space-10 = 4/8/12/16/20/24/32/40/48/64. Every margin/padding snaps to it.

TYPOGRAPHY: Inter variable, self-hosted woff2 in public/fonts, preload + font-display: swap; stack "InterVariable", Inter, -apple-system, "Segoe UI", sans-serif. Sizes: 12px meta (due/tags), 13px chrome (sidebar/buttons), 15px/1.5 task titles (weight 400), 17px/600 subheads, 20px/600 page header (letter-spacing -0.02em). font-variant-numeric: tabular-nums on counters and dates. Nothing below 12px.

COLOR TOKENS (styles/tokens.css; components use ONLY semantic tokens, never raw hex):
Light (:root): --bg-app #F7F7F8; --bg-surface #FFFFFF; --bg-subtle #F1F1F3; --bg-active #E9E9EC; --border #E4E4E7; --border-strong #D4D4D8; --text-primary #18181B; --text-secondary #52525B; --text-tertiary #9B9BA4; --accent #5B5BD6; --accent-hover #5151CD; --accent-soft #EDEDFC; --danger #E5484D; --danger-soft #FEEBEC; --success #30A46C; --prio-high #E5484D; --prio-med #DC8A0E; --prio-low #0B84D0; --focus rgba(91,91,214,.45).
Dark ([data-theme="dark"], and duplicated in @media (prefers-color-scheme: dark){:root:not([data-theme])}): --bg-app #101013; --bg-surface #17171B; --bg-subtle #1E1E23; --bg-active #26262C; --border #26262C; --border-strong #34343B; --text-primary #EDEDF0; --text-secondary #A9A9B2; --text-tertiary #6E6E78; --accent #7C7CF0; --accent-hover #8F8FF4; --accent-soft #232338; --danger #FF6369; --danger-soft #3B1A1C; --success #3DD68C; --prio-high #FF6369; --prio-med #F5A623; --prio-low #4CA9F5; --focus rgba(124,124,240,.5). Plus color-scheme: light dark on :root. Dark is hand-tuned: surfaces lighten as they rise; NEVER pure black; elevation in dark = lighter surface + 1px --border-strong + inset 0 1px 0 rgba(255,255,255,.04); shadows barely used.

RADII: --radius-sm 6px (checkbox, chips, kbd), --radius-md 10px (rows, inputs, buttons), --radius-lg 14px (popovers), --radius-full 999px (count pills). ELEVATION (light): --shadow-1 0 1px 2px rgba(0,0,0,.04); --shadow-2 0 2px 8px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04) (dragged row, focused QuickAdd); --shadow-3 0 16px 40px -8px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04) (popover).

MOTION: transform/opacity only; all behind @media (prefers-reduced-motion: reduce). Durations --dur-fast 120ms (hover/color), --dur-base 200ms (checkbox, chips), --dur-slow 260ms (enter/exit, reorder). Easings --ease-out cubic-bezier(0.2,0,0,1); --ease-spring cubic-bezier(0.34,1.56,0.64,1); --ease-in cubic-bezier(0.4,0,1,1). Task enter: opacity 0→1 + translateY(-4px) 200ms. Delete: opacity+scale(.98) out 150ms then measured max-height collapse 200ms. Reorder: dnd-kit transforms, lifted row scale 1.02 + --shadow-2, siblings glide. Toast: slide up 12px + fade. Theme switch: instant, no global transition.

CHECKBOX (the signature moment): 18px button, radius 6px, 1.5px border in the task's priority color (--prio-*; --border-strong when NONE); hover = faint priority-tint fill; press = scale(.92). On check: fill animates to --accent (150ms); inline SVG check path draws stroke-dashoffset 24→0 over 200ms --ease-out; box pops scale 1→1.08→1 with --ease-spring; a 4px --accent-soft ring blooms and fades 300ms. Simultaneously the label strikethrough sweeps left→right (1px linear-gradient background-image animating background-size 0%→100%, 240ms) while text fades to --text-tertiary; the footer counter digit slides (old translateY out, new in, 160ms). Unchecking reverses instantly — no ceremony in the wrong direction.

ROW METADATA: priority lives only in the checkbox border + popover flag (no row badges). Due date: 12px meta line under the title only when present — 'Today' in --accent/500, future in --text-secondary ('Tomorrow', 'Fri', 'Sep 12'), overdue in --danger/500 ('Yesterday', '3d overdue'). Tags: #name chips, 12px, --text-tertiary on --bg-subtle pill, radius-full; click filters. Hover-revealed row actions (edit/delete icons fade in 120ms) keep the resting list calm. Icons: ~8 custom 1.5px-stroke inline SVGs; no emoji, no icon font.

FOCUS & A11Y: :focus-visible only, never remove outlines; double ring box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px var(--focus). Roving tabindex on the list; focused row shows --bg-subtle + ring; shortcuts act on it. Real <button>/<input> elements; focus trap + Escape in popover; aria-live="polite" on counter and undo toast; dnd-kit keyboard sensor announcements. All text pairs ≥ 4.5:1 in both themes.

EMPTY STATES: all-done = 44px inline stroke SVG (check in soft circle, --text-tertiary, 1.5px), 'All clear.' 15px --text-primary + 'Nothing due — take a breath.' 13px --text-tertiary, fade in after 150ms. Search-empty = 'No matches for "query"' + ghost 'Clear search' button. First run = 'Press N or type below to add your first task' with a <kbd>N</kbd> keycap. Completed-filter-empty gets its own copy.

PREMIUM CHECKLIST (acceptance criteria): one accent used sparingly; hairline borders over shadows; strict spacing scale; tabular numerals; kbd hint chips; no native date input; no default-blue links; both themes screenshot-checked; custom thin scrollbars; real favicon + document title.

## Migration plan

PHASE A — localStorage v1→v2 (runs once inside LocalStorageAdapter.init(), before first read; unit-tested in test/migration.test.ts):
1. If key 'todo.app.v2' exists and parses to {schemaVersion:2,...} → done, no migration. If it exists but is corrupt → copy the raw string to 'todo.app.v2.corrupt', console.error, start with an empty envelope (never throw on boot).
2. Else read legacy key 'todo-app-items'. Absent → write a fresh empty envelope {schemaVersion:2, tasks:[], tags:[]} to 'todo.app.v2'.
3. If the legacy value parses to an Array, map each legacy item {id:number, text, done, priority, due} to a Task:
   - id: crypto.randomUUID()
   - title: String(text).trim().slice(0,500); DROP the item if empty after trim
   - notes: null; parentId: null; tagIds: []
   - priority: ['low','medium','high'].includes(priority) ? priority.toUpperCase() : 'NONE'
   - dueDate: (typeof due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due) && real calendar date) ? due : null
   - completedAt: done === true ? nowISO : null
   - position: (index + 1) * 1024 (preserves original order)
   - createdAt: Number.isFinite(id) && id > 1e12 ? new Date(id).toISOString() : nowISO (legacy Date.now() ids double as creation timestamps); updatedAt: nowISO
4. Write {schemaVersion:2, tasks, tags:[]} to 'todo.app.v2'.
5. NEVER write to or delete 'todo-app-items' — it stays untouched forever as the rollback artifact.
6. Malformed legacy JSON (non-array, parse error) → start empty, keep the legacy key, console.warn.
Theme preference is separate: 'todo.app.theme' = 'light'|'dark'|'system' (default 'system').

PHASE B — flip to API (documented in README as the headline story):
1. docker compose up -d (mysql:8.4) → cd backend && ./gradlew bootRun (Flyway applies V1__init.sql + user seed).
2. In the running local app: export (sidebar footer) → produces the {schemaVersion:2, tasks, tags} envelope (or ApiAdapter does this automatically: on init, if server GET /tasks is empty and 'todo.app.v2' has data, POST /api/v1/import with the envelope).
3. Set frontend/.env: VITE_STORAGE_MODE=api, VITE_API_BASE_URL=http://localhost:8080/api/v1; restart Vite.
4. Verify: task/tag counts match, full CRUD pass, reorder, clear-completed+undo, both themes. Local 'todo.app.v2' is left intact as backup.
5. Pre-flip gate: the shared adapter contract test suite green against both adapters, plus this one manual end-to-end pass.

PHASE C — future, all additive (documented, not built): auth = Spring Security + token header, new users rows (user_id FK already everywhere, CurrentUser stub is the seam); projects = new projects table + nullable tasks.project_id + backfill; subtasks UI = parent_id already shipped (enforce one-level in TaskService); optimistic locking = version BIGINT + @Version; recurrence = one nullable column. schemaVersion bumps in the envelope gate any future localStorage shape change.

## Open questions — resolutions

- Q: Is Docker available in the dev/CI environment for Testcontainers MySQL? If not, backend integration tests need a documented fallback (H2 with known CHECK/collation divergence) or become docker-gated.
  - RESOLVED: Docker 28.5.1 is installed and the daemon is running — use Testcontainers MySQL as specced.
- Q: Legacy 'due' values are assumed 'YYYY-MM-DD' (from the old date input); confirm no other formats exist in real localStorage data before the migrate-else-null rule discards them.
  - RESOLVED: legacy due values come exclusively from an <input type=date> (see legacy/app.js) — always 'YYYY-MM-DD' or ''. The migrate-else-null rule is safe.
- Q: Should import/export be a visible sidebar UI in v1 or a settings-menu/dev-only affordance? Spec assumes a small sidebar-footer entry.
  - RESOLVED: small import/export entry in the sidebar footer (as specced).
- Q: Vendor the Inter variable woff2 (OFL license) into frontend/public/fonts — confirm the asset is available to the frontend builder; otherwise ship the system-ui fallback stack and add the font later.
  - RESOLVED: attempt to vendor Inter variable woff2 into frontend/public/fonts (network is available); if the download fails, ship the system-ui fallback stack and leave a TODO in README.
