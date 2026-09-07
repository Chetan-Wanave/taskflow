# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Taskflow** — a production-grade TODO app (rebuild of the legacy vanilla-JS app in `legacy/`).
Monorepo:

- `frontend/` — Vite 6 + React 19 + TypeScript strict. Zustand store, @dnd-kit drag-and-drop,
  CSS Modules + design tokens (no Tailwind, no UI kit). Persistence via a `StorageAdapter`
  abstraction; **localStorage mode is active by default** (`VITE_STORAGE_MODE=local`).
- `backend/` — Spring Boot **3.5.3** (pinned — do NOT upgrade to 4.x), Java 21, Gradle
  wrapper 8.14.2 (Groovy DSL), package `com.chetanwanave.todo`. Full REST API, dormant in
  default runtime but complete and integration-tested.
- `legacy/` — the old vanilla app. **Read-only forever** (a PreToolUse hook in
  `.claude/settings.json` refuses any Write/Edit under `legacy/` — a refusal there is
  expected behavior, not an error).
- `SPEC.md` — **single source of truth** for the data model, REST contract, visual tokens,
  and migration algorithm. Where anything conflicts with SPEC.md, SPEC.md wins.
- `schema.sql` — checked-in copy of the canonical DDL, byte-identical to
  `backend/src/main/resources/db/migration/V1__init.sql`. Change one → change both.
- `docker-compose.yml` — dev MySQL 8.4.
- Dated `*-2026-09.*` files at root — design/plan homework artifacts; reference material,
  not code.

## Run commands

Frontend (`cd frontend`):

```bash
npm run dev        # Vite dev server, http://localhost:5173
npm run build      # tsc -b && vite build
npm run test       # vitest run (99 tests, incl. adapter contract suite vs BOTH adapters)
npm run lint       # oxlint
npm run preview
```

Backend (`cd backend`) — needs the MySQL container first:

```bash
docker compose up -d          # from repo root; starts mysql:8.4 (db 'todo', user/pass todo/todo)
./gradlew bootRun             # port 8080; Flyway applies V1__init.sql + user seed
./gradlew build               # includes Testcontainers MySQL integration tests (38 tests; Docker must be running)
```

**MySQL port:** compose and `application.properties` both honor the `MYSQL_PORT` env var
(default 3306). On this machine 3306 is occupied by an unrelated container, so use 3307:

```bash
MYSQL_PORT=3307 docker compose up -d
MYSQL_PORT=3307 ./gradlew bootRun
```

Full-stack (API) mode: backend up, then set `frontend/.env` → `VITE_STORAGE_MODE=api`
(and `VITE_API_BASE_URL`, default `http://localhost:8080/api/v1`), restart Vite.
Swagger UI at `http://localhost:8080/swagger-ui.html`. CORS allows `http://localhost:5173` only.

## Architecture

### The five-layer canonical data model (the core invariant)

One domain model (`Task`, `Tag`, `AppData` envelope, `Priority` = `NONE|LOW|MEDIUM|HIGH`)
is described identically in five places. Nothing enforces cross-boundary parity at build
time, so **any domain-model change must update all five layers, then run `/contract-check`**:

1. TS types — `frontend/src/domain/types.ts`
2. localStorage envelope + v1→v2 migration — `frontend/src/storage/migration.ts`
3. REST DTOs — `backend/src/main/java/com/chetanwanave/todo/dto/`
4. JPA entities — `backend/src/main/java/com/chetanwanave/todo/entity/`
5. MySQL DDL — `backend/src/main/resources/db/migration/V1__init.sql` ≡ root `schema.sql`

Naming: camelCase in TS/JSON ↔ snake_case in SQL (`dueDate`↔`due_date`, `completedAt`↔`completed_at`).
`user_id` exists only in SQL/JPA (seeded user `00000000-0000-0000-0000-000000000001`,
resolved by the `CurrentUser` stub) — never in DTOs or TS. Ids are client-minted UUIDv4
strings (`crypto.randomUUID()`), `CHAR(36)` in MySQL, plain `String` in JPA.

### Frontend

- **StorageAdapter pattern** (`frontend/src/storage/`): `StorageAdapter.ts` is the interface;
  `LocalStorageAdapter` (active) and `ApiAdapter` (dormant) implement identical semantics.
  `createAdapter.ts` picks one from `VITE_STORAGE_MODE` (`local` default | `api`).
  A shared vitest contract suite (`src/test/adapterContract.test.ts`) runs against both
  (ApiAdapter over MSW) — it is what keeps the dormant adapter honest.
- **Zustand store** (`src/store/useAppStore.ts`): every mutation is optimistic — snapshot →
  apply pure function from `src/domain/mutations.ts` → await adapter → on rejection restore
  snapshot + error toast. Filter/search/edit state is view-state only, never persisted.
- **Sparse position ordering** (`src/domain/position.ts`): gap 1024, drop = midpoint of
  neighbors, renormalize whole list to `(i+1)*1024` when any gap < 2 (batch write
  `reorderTasks` / `PUT /tasks/positions`). Same math runs in both storage modes.
- **Dates**: `dueDate` is a `'YYYY-MM-DD'` string end-to-end; comparisons are string-based
  via `src/domain/dates.ts`. NEVER `new Date('YYYY-MM-DD')`.
- **Completion**: `completedAt` timestamp; `done` is derived (`completedAt !== null`).
  Clients send `completed: boolean`; the executing side stamps the timestamp.
- **Theme**: pre-paint inline script in `index.html` sets `data-theme` from
  `todo.app.theme`; tokens in `src/styles/tokens.css` (components use semantic tokens only,
  never raw hex).

### localStorage keys — the NEVER rules

- `todo.app.v2` — versioned envelope `{schemaVersion: 2, tasks, tags}`.
- `todo.app.theme` — `'light'|'dark'|'system'`.
- `todo.app.v2.corrupt` — quarantine copy if the v2 envelope fails to parse.
- **`todo-app-items` (legacy) is NEVER written or deleted** — it is the migration rollback
  artifact, read exactly once by the v1→v2 migration. Same rule as the `legacy/` directory,
  but no hook can guard a browser localStorage key — enforcement is this instruction plus
  the reviewer agent's checklist.

### Backend

- Layered: `controller/` (HTTP only, `@Valid`) → `service/` (`@Transactional`, owns position
  append, batch reorder, clear-completed, `completed`→`completedAt` stamping, tagIds
  resolution, import upsert) → `repository/` → `entity/`. Hand-written mappers in `mapper/`
  (no MapStruct).
- **Flyway owns the DDL** — `spring.jpa.hibernate.ddl-auto=validate`; Hibernate never
  generates schema. All `DATETIME(3)` values UTC (`hibernate.jdbc.time_zone=UTC`).
- Errors: RFC 9457 `application/problem+json` with `errors:[{field,message}]`
  (`exception/GlobalExceptionHandler`). 400 validation, 404 unknown id, 409 conflict,
  no 422; DELETE idempotent (204 even when missing). PATCH (not PUT) for updates.
- PATCH tri-state (absent vs null vs value) uses `JsonNullable`
  (jackson-databind-nullable); its validation intentionally lives in the service layer,
  not bean annotations. Custom `Instant` millisecond serializer in `config/JacksonConfig`.
- Tests: `@SpringBootTest` + MockMvc against **Testcontainers MySQL** (never H2), including
  an exact-JSON `TaskResponse` serialization test that pins the wire format to SPEC.md.

## Design source of truth & repo tooling

- `SPEC.md` first for any design/contract question — its "Final decisions" section records
  judge-arbitrated choices (what was cut and why); don't re-litigate or resurrect cut scope.
- `/contract-check` skill — five-layer parity audit; run before/after touching
  `frontend/src/domain/` or backend entities/DTOs/DDL.
- `/review-changes` skill — reviews the *staged* git diff via the read-only `reviewer`
  agent (`.claude/agents/reviewer.md`).
- Hooks: shared `.claude/settings.json` — PreToolUse guard on `legacy/` writes +
  SessionStart reminder (the guard needs `jq`); per-machine `.claude/settings.local.json` —
  PostToolUse write log (`.claude-tool-log.txt`) + MCP approval (`enabledMcpjsonServers`).
- Playwright MCP in root `.mcp.json` — browser verification of the running app; approve on
  first use, restart the session after adding, artifacts land in `.playwright-mcp/`
  (gitignored). `mentor` output style via `/output-style mentor`.
- Harness rationale, per-artifact, lives in `HARNESS.md`.

## Restrictions

- Work only inside `/Users/chewan/Desktop/TODO` (plus `/tmp` for scratch). Do not read or
  write anything outside this directory.
- `legacy/` and the `todo-app-items` localStorage key are read-only forever.
- Keep Spring Boot on 3.5.3 and the Gradle wrapper on 8.14.2; do not bump.
