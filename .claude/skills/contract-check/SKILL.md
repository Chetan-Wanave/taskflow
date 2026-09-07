---
name: contract-check
description: Verify contract parity across the five layers of the Taskflow data model — TypeScript types, localStorage envelope/migration, REST DTOs, JPA entities, and MySQL DDL. Use before changing the domain model, after any builder/agent touched frontend/src/domain or backend entities/DTOs, or when an API-mode bug smells like schema drift.
argument-hint: [entity or field to focus on, e.g. Task.position — omit to check everything]
---

The Taskflow repo's core invariant: one canonical data model described identically in
five places. Nothing enforces this at build time across the frontend/backend boundary,
so drift is silent until the localStorage→MySQL flip breaks. Check parity now.

## Sources (read in this order)

1. `SPEC.md` § "Canonical data model" and § "MySQL schema" — the **authority**.
2. `frontend/src/domain/types.ts` — TS `Task`, `Tag`, `AppData`, `Priority`.
3. `frontend/src/storage/migration.ts` — the v1→v2 field mapping.
4. `backend/src/main/java/com/chetanwanave/todo/dto/` — request/response records.
5. `backend/src/main/java/com/chetanwanave/todo/entity/` — JPA entities.
6. `backend/src/main/resources/db/migration/V1__init.sql` **and** root `schema.sql`
   — these two must be byte-identical; diff them first.

If `$ARGUMENTS` names an entity or field, restrict the check to it; otherwise check
every field of every entity.

## What to compare, field by field

- **Name mapping**: camelCase (TS/DTO JSON) ↔ snake_case (SQL) per the SPEC table
  (`dueDate`↔`due_date`, `completedAt`↔`completed_at`, `parentId`↔`parent_id`, …).
- **Type**: TS type ↔ DTO Java type ↔ entity Java type ↔ SQL column type
  (e.g. `dueDate: string|null` ↔ `LocalDate` ↔ `DATE`; `position: number` ↔ `Long`
  ↔ `BIGINT`; ids `string` ↔ `String` ↔ `CHAR(36)`).
- **Nullability**: TS `| null` ↔ DTO validation ↔ `@Column(nullable=)` ↔ SQL `NULL`.
- **Enums**: `Priority` union members ↔ Java enum constants ↔ SQL CHECK list —
  same spellings, same case (`NONE|LOW|MEDIUM|HIGH`).
- **Constraints**: title 1–500, notes ≤10000, tag name 1–50 unique per user
  case-insensitive, color `#RRGGBB` — present at all three enforcement points
  (frontend `domain/validation.ts`, Jakarta annotations, SQL CHECK/UNIQUE).
- **Serialization surface**: `user_id` must exist in entity/SQL but NEVER in DTOs
  or TS. `completed` (boolean) appears only in PATCH requests; `completedAt` only
  in responses/state.

## Output format

One table per entity:

| Field | TS | DTO | Entity | SQL | Verdict |

Verdict is `OK` or `DRIFT`. After the tables:
- **Drifts**: each with `file:line` for every side of the mismatch, which layer
  contradicts SPEC.md, and the one-line fix.
- **Missing layers**: if a file doesn't exist yet (mid-build), report it as
  `NOT BUILT YET` — that is not drift; do not fail on it.
- Final line: `CONTRACT: CLEAN` or `CONTRACT: N DRIFT(S)`.
