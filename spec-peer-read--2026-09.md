# Peer read — Duplicate task spec (2026-09-13)

Companion to `spec--2026-09.md`. Exercise step **Verify**: hand the spec to a peer who has
never seen the feature and ask what they would build.

## Setup

- **Peer:** a fresh subagent (general-purpose, no shared conversation history) told to
  act as a backend developer who just joined Taskflow. It was given the spec path,
  allowed to read `CLAUDE.md`, `SPEC.md` and source, forbidden from editing or reading
  the other dated exercise docs.
- **Ask:** "Read this and tell me what you would build." Structured answer requested:
  what they'd build, backend work, assumptions, pushback, questions, and whether they
  read the spec's §6–7 (evaluation + proposed shape) before forming their design.
- **Caveat on independence:** the peer reported the whole file loaded at once, so §6–7
  were on-screen. It says it formed the design from §1–5 and the source first and that
  §7's signature matched what it had already sketched. Treat the match score as
  slightly optimistic for that reason.

## What the peer said they would build (condensed)

1. **Pure function** `duplicateTask(source, ordered, newId, now): { task, renormalized? }`
   in `domain/mutations.ts`. Copies title, notes, priority, dueDate, tagIds (spread),
   parentId; `completedAt: null`; `createdAt = updatedAt = now`. `ordered` = **all** tasks
   by position, not the filtered view. Uses `needsRenormalize` / `renormalize` /
   `midpoint` from `position.ts` only.
2. **Store action** `duplicateTask(id): Promise<boolean>`: missing source → `false`, no
   writes; snapshot; if renormalized → apply locally, `await reorderTasks`; insert copy,
   select it; `await createTask`; adopt the saved row (same pattern as `addTask`); on
   rejection remove the copy but **keep the already-persisted renormalized positions**,
   push error toast, return `false`.
3. **Row UI:** third `IconButton` between Edit and Delete, `label="Duplicate task"`
   exactly (no shortcut suffix in the accessible name), new copy icon, hover/focus
   revealed like the others.
4. **Shortcut:** inside the existing `case 'd'/'D'` in `lib/keyboard.ts`, branch on
   `event.shiftKey` (not letter case, so CapsLock+D still toggles). `focusRow(copy.id)`
   after the promise resolves true.
5. **Kbd hint** in the same place the other shortcuts are listed; not in the button name.
6. **Tests:** mutations (fields, 2560, 3072, no-gap → batch then 1536, source not
   mutated); new `store.test.ts` (optimistic presence, rollback + toast, unknown id → no
   adapter calls, two-write ordering, legacy key byte-identical); rowInteractions (click,
   Shift+D, plain d); adapterContract (`createTask(copy)` on both adapters).
7. **Backend: nothing.** Verified in code that `POST /tasks` already accepts client id,
   position, parentId and tagIds, and that renormalization rides the existing
   transactional `PUT /tasks/positions`. No DTO/entity/DDL/Flyway change.

## Match against intent

| Area | Spec intent | Peer | Match |
|------|-------------|------|-------|
| Fields copied / completedAt null / fresh id + timestamps | FR3–FR5 | identical | yes |
| Position directly below source; midpoint / append / renormalize-first | FR6, AC2–AC4 | identical, including write order | yes |
| Title verbatim, no "(copy)" suffix | O1 | never raised it | yes |
| No backend change, no endpoint, no migration | C1, C2, O7 | "Nothing", verified in code | yes |
| Optimistic insert + rollback + error toast | FR7, AC5–AC6 | identical | yes |
| Source missing → false, zero adapter calls | AC7 | identical | yes |
| Button label, placement, real `<button>` | FR1, C8 | identical | yes |
| Shift+D via `shiftKey` | FR2 | identical (and tightened the wording) | yes |
| Pure function shape | §7 | identical signature | yes (saw §7) |
| Test layout incl. new store test file | §6.1 | identical set | yes (saw §6) |
| Rollback state after failed create on the no-gap path | spec: "snapshot" (loose) | keep persisted renormalized positions | peer was **more precise** than spec |
| Focus after create / filter-hidden copy | FR9, C8 partial | create copy, no filter switch, focus copy | consistent with spec, spec was thinner |

**Estimate: ~90–95 % match.** No invented feature. Every divergence was the peer being
more precise than the spec, not different from it.

## What the peer found wrong in the spec (all verified, all fixed in `spec--2026-09.md`)

1. **Toast field name.** Spec wrote `tone: "error"`; the store's `Toast` type uses
   `kind: 'info' | 'error'`. A test written from the spec would fail on day one. Fixed in
   AC6 and §3.
2. **`updatedAt` on the source.** Spec's §6.3 invariant claimed "no `updatedAt` bump on
   S". Both adapters bump `updatedAt` for every task in a `reorderTasks` batch
   (`LocalStorageAdapter.reorderTasks` sets it explicitly; the server via `@PreUpdate` on
   `TaskEntity`). On the no-gap path S's timestamp does change. Invariant loosened; note
   added to C6.
3. **API-mode timestamps.** The real server stamps `createdAt`/`updatedAt` itself and
   ignores the client's `now`, so "adapter resolves with a task equal to C" (AC10) holds
   against MSW, not the live backend. The store must adopt the returned row, which the
   existing `addTask` pattern already does. Left AC10 as-is since the contract suite runs
   over MSW, but this is worth knowing.
4. **CapsLock ambiguity** in "D alone keeps its meaning". Reworded FR2 to `shiftKey`.
5. **Filtered-view neighbour.** Spec said "immediately below the source in the ordered
   list" without saying which list. Peer assumed the full list; FR6 now says so.

## Peer's open questions (author's answers)

1. Toast text: adapter message or literal? → **Adapter message**, via existing `pushError`.
2. Hint toast when the copy is filter-hidden? → **No**, out of scope for v1 (adds to O4).
3. No-op while inline edit / popover open? → **Yes, follow the existing guard**: the
   keyboard handler already ignores shortcuts when an input is focused; the button is
   hidden during inline edit like Edit/Delete.
4. Kbd hint location? → Same place as the other shortcuts (title text / shortcut list),
   never inside the accessible name.
5. Pin two-write ordering in the store test? → **Yes**, add it to AC4's store assertion.

## Takeaways for the exercise

- The spec did its job on the **feature**: the peer built the same thing without asking
  a blocking question. The forced section (Out of scope, O1 title suffix) held: the peer
  never considered a suffix.
- The spec was **wrong where it touched code it did not check**: a field name and a
  timestamp side-effect. Both were caught because the peer read source, not just the
  spec. A spec that names concrete types should be verified against them before the
  hand-off, the same way a bullet in a résumé gets an honesty check.
- The error-case invariant was the most valuable sentence to write and the first one to
  be falsified. Writing "what must not change" forced a claim precise enough to be wrong.
