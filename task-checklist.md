# Task checklist — direct unit tests for `domain/validation.ts` and `domain/mutations.ts`

Session started 2026-09-07. Exercise: "Keep a long session on the rails" (Session Mastery).
This file is re-injected after every compaction by the `SessionStart` hook with
`"matcher": "compact"` in `.claude/settings.json`.
**Claude: read this file before every step and update it after finishing each step.**

## Why this task
`frontend/src/domain/validation.ts` and `frontend/src/domain/mutations.ts` are pure
functions shared by the QuickAdd composer and BOTH storage adapters, but they have no
direct unit tests — only indirect coverage through `src/test/adapterContract.test.ts`.
`tagNameKey` (accent + case folding that mirrors MySQL `utf8mb4_0900_ai_ci`) and the
`applyTaskPatch` tri-state (absent / null / value) are exactly the semantics that regress
silently. Deliverable: two new test files. No production code changes expected.

## Steps
- [x] 0. Setup — write this checklist; add the compact-matcher SessionStart hook to
      `.claude/settings.json`.
- [x] 1. Baseline (DELEGATED — summary only, raw output stays out of main context) — run
      the full vitest suite once; record pass count, duration, pre-existing failures.
      `/context` reading BEFORE this step: 71.5k / 1m (7%) · AFTER: 91.5k / 1m (9%).
      Main context grew 20k (summary + checklist edits + messages) while the workflow
      burned ~185k in subagents — roughly 9× kept out of the conversation.
- [x] 2. Coverage audit (DELEGATED, same workflow as step 1) — for every export of
      `validation.ts` and `mutations.ts`: which test files reference it directly, which
      are only hit indirectly. Output: table of export → direct test refs.
- [x] 3. Quick call-site search (DELIBERATE MODEL SWITCH → haiku, Explore agent, 43 s,
      ~30k subagent tokens) — where `tagNameKey`, `validateImportData`, `applyTaskPatch`
      are called. Learned: (a) non-empty `errors` from validateImportData → callers reject
      the WHOLE import, nothing written (`RepositoryError('validation')` / HTTP 400);
      (b) tag create compares `tagNameKey` against all tags, rename against all-except-self,
      collision → `'conflict'` / 409; (c) both callers of applyTaskPatch pass
      `new Date().toISOString()` as `now`, and LocalStorageAdapter validates the patch
      BEFORE applying it — so mutation tests pass a fixed ISO string and never validate.
- [x] 4. (37 tests, all green, `tsc -p tsconfig.app.json --noEmit` clean)
      Write `frontend/src/test/validation.test.ts` — tagNameKey folding; each
      validateX rule at its boundary (blank / 500 / 10 000 / 50 chars, `#RRGGBB`,
      non-integer position); validateTask + validateTaskPatch unknown-tag errors;
      validateImportData (rejects malformed rows, prefixes field paths like
      `tasks[0].title`, trims titles and tag names, returns nothing when any error).
- [x] 5. (30 tests, all green, tsc clean; SPEC §PATCH + backend TaskService:137 confirm
      `completed:true` re-stamps unconditionally, so that case is pinned too)
      Write `frontend/src/test/mutations.test.ts` — buildTask defaults + appendPosition;
      applyTaskPatch tri-state (absent = unchanged, null = cleared, value = set);
      `completed` stamps / clears `completedAt` with `now`; tagIds copied not aliased;
      sortByPosition does not mutate its input.
- [x] 6. Run the suite again (DELEGATED — summary only) — all green; record new count.
      Result: 7 files, 166/166 passed, 0.99 s, tsc clean. The same workflow ran a
      vacuous-assertion audit over the 67 new tests: 1 weak finding (import-timestamp
      checks were `typeof === 'string'`), fixed by asserting the ISO-ms shape + equality.
- [x] 7. Stage ONLY the two new test files; run `/review-changes`; address findings.
      Staged: `validation.test.ts` + `mutations.test.ts` (dates.ts / position.ts were
      already in the index from earlier work and were left alone). Review → `REVIEW: CLEAN`
      (0 findings; run via the fallback in D6, 6 tool uses, ~45k subagent tokens, 3 min).
- [x] 8. Write the Handoff and the three where-does-this-belong choices below.
      Placed: convention → CLAUDE.md (+ count 99→166); path → Handoff below; decision →
      auto memory `long-session-recovery-pattern.md` (+ MEMORY.md index line).

## Decisions Made
- D1 (2026-09-07): Scope = tests only. If a test exposes a real production bug, record
  it here and STOP — fixing it is a separate task, not a silent scope expansion.
- D2: New test files go in `frontend/src/test/` beside the existing ones
  (`dates.test.ts`, `position.test.ts`), not co-located with the source.
- D3: Style follows `dates.test.ts`: header comment saying WHY the module is pinned,
  fixed constants (never the wall clock), one `describe` per exported function.
- D4: `validateImportData` calls `new Date().toISOString()` for missing timestamps —
  tests assert shape (`typeof === 'string'`), not value. No fake timers.
- D5: The compact hook command is guarded (`[ -f … ] && cat …`) so it stays silent
  instead of erroring once this task file is eventually deleted.
- D6: `/review-changes` step 2 asks for subagent type `reviewer`, but that type was not
  registered in this session (Agent tool listed only the built-ins). Fallback used: an
  Explore agent (no Write/Edit tools) on haiku with `reviewer.md`'s instructions inlined
  verbatim — same least-privilege intent, same checklist, same `REVIEW:` sentinel. The
  31 KB staged diff was passed as a file path, not pasted, so it never entered main context.

## Findings from delegated steps (summaries only — raw output never entered main context)
- Baseline (step 1): `npx vitest run` → 5 files, 99/99 passed, 0 skipped, 1.06 s, no
  warnings. Per file: adapterContract 55, dates 18, position 11, migration 11,
  rowInteractions 4.
- Audit (step 2): ALL 17 exports of `validation.ts` (12) and `mutations.ts` (5) have
  ZERO direct test references — every claim independently re-grepped and verified.
  Indirect coverage exists only through `LocalStorageAdapter` and the MSW `mockApi.ts`,
  both driven by `adapterContract.test.ts`.
- Biggest gap: `buildTask` has NO coverage at all, even indirectly — no test drives
  `addTask`/`createTask` through it. `validateNotes` / `validateDueDate` are reached only
  via `validateTask`. Three exported interfaces (`TaskPatchLike`, `ImportValidationResult`,
  `TaskPatchFields`) have no importers outside their own file (note only — D1 says no
  production changes).
- Isolation cost/benefit: the workflow spent ~185k subagent tokens across 5 agents and
  46 tool calls in 5.6 min; the summary that entered main context is ~4k tokens.
- Full run after step 5 (step 6): 7 files, 166/166 passed (99 baseline + 37 + 30),
  0 skipped, 0.99 s, no warnings, `tsc -p tsconfig.app.json --noEmit` clean. Per file:
  adapterContract 55, validation 37, mutations 30, dates 18, position 11, migration 11,
  rowInteractions 4. Side note from the runner: CLAUDE.md still says "99 tests".
- Audit of the 67 new tests (step 6, 2 agents, ~70k subagent tokens, 100 s): no vacuous
  or mismatched assertions; one WEAK finding at `validation.test.ts:313` — `typeof x ===
  'string'` would accept `'undefined'`, `''`, or a non-ISO string. Fixed (ISO-ms regex +
  the three fills are asserted equal, since one `nowISO` at validation.ts:143 feeds all).

## Current Status
ALL STEPS 0–8 DONE (2026-09-07). Both test files are staged and reviewed clean; nothing is
committed yet. The only remaining work is in the Handoff below and is meant for a FRESH
session that receives that section and nothing else.

## Handoff
Repo: `/Users/chewan/Desktop/TODO` (work only inside it). Task: direct unit tests for
`frontend/src/domain/validation.ts` and `frontend/src/domain/mutations.ts`. Everything
below is current as of 2026-09-07 23:35 local.

**Done**
- `frontend/src/test/validation.test.ts` (37 tests) and `frontend/src/test/mutations.test.ts`
  (30 tests) are written, green, `tsc -p tsconfig.app.json --noEmit` clean, and STAGED.
  Full suite: 7 files, 166/166. `/review-changes` on the staged diff → `REVIEW: CLEAN`.
- `.claude/settings.json` has a SessionStart hook with `"matcher": "compact"` that cats
  this file back into context; verified it fires right after a manual `/compact`.
- `session-recovery-2026-09.md` Part 1 records that recovery. Part 2 is still empty.
- `CLAUDE.md` gained the domain-test convention and the count 166; `HARNESS.md` gained the
  compact-hook bullet; auto memory gained `long-session-recovery-pattern.md`.

**Next (in order — none of these needs a question)**
1. `cd frontend && npx vitest run` → expect `7 passed`, `166 passed`. Anything else: stop
   and report the failing test names; do not fix production code (D1).
2. Append **Part 2** to `session-recovery-2026-09.md` (heading already exists): what this
   fresh session received, what it did first, and any question it needed to ask that this
   Handoff should have answered. If nothing was missing, say so.
3. Commit the test work, pathspec-limited so the rest of the index is untouched:
   `git commit -m "test(frontend): pin domain/validation and domain/mutations directly" -- frontend/src/test/validation.test.ts frontend/src/test/mutations.test.ts CLAUDE.md`
   (add the session's Co-Authored-By trailer). Do NOT run `git add -A` or `git add .`:
   most of `frontend/` and `backend/` is deliberately untracked in this repo. `dates.ts`
   and `position.ts` are in the index from separate earlier work (`position.ts` also has a
   7-line unstaged hunk) — leave both exactly as they are.
4. Commit the exercise artifacts: `git add .claude/settings.json HARNESS.md
   task-checklist.md session-recovery-2026-09.md` then commit as
   "docs: session-mastery exercise — compact hook, task checklist, recovery log".
5. Stop. Do not delete `task-checklist.md`; it is a graded deliverable.

**Files that matter**
- New, staged: `frontend/src/test/validation.test.ts`, `frontend/src/test/mutations.test.ts`.
- Sources under test (unchanged, do not edit): `frontend/src/domain/validation.ts`,
  `frontend/src/domain/mutations.ts`, `frontend/src/domain/position.ts` (`appendPosition`).
- Style reference: `frontend/src/test/dates.test.ts`.
- Exercise artifacts: this file, `session-recovery-2026-09.md`, `.claude/settings.json`
  (compact hook = the second SessionStart entry), `HARNESS.md`, `CLAUDE.md`.
- Evidence outside the repo (read-only): workflow journals under
  `~/.claude/projects/-Users-chewan-Desktop-TODO/8a5ea339-b833-4e95-ac83-d52914dc44d8/subagents/workflows/`
  — `wf_b3d77ce9-45d` (baseline + coverage audit) and `wf_0ccc6c02-967` (full run +
  vacuous-assertion audit); the reviewed staged diff is `…/tool-results/binotbf9e.txt`.

**Decisions made** (full text in "Decisions Made" above)
- D1 tests only; a real production bug means stop, not fix.
- D2 tests in `frontend/src/test/`, not co-located.
- D3 `dates.test.ts` style; `now` is a fixed ISO constant, never the wall clock.
- D4 wall-clock-filled import timestamps: assert ISO-ms shape + that all three fills are
  identical (tightened from `typeof === 'string'` after the vacuous-assertion audit).
- D5 compact hook is guarded on file existence, so it goes silent when this file is gone.
- D6 `reviewer` agent type did not load this session; used Explore-on-haiku with
  `reviewer.md` inlined, diff passed by path.
- Observation, deliberately NOT tested or changed (D1): `buildTask` aliases `input.tagIds`
  while `applyTaskPatch` copies `patch.tagIds`. Harmless today; worth a copy if the store
  ever mutates tag arrays in place.

## Where does each fact belong?
Three facts this session produced, each placed in exactly one home:

1. **Convention → `CLAUDE.md`** — "Domain unit tests live in `frontend/src/test/` (not
   co-located), open with a header comment saying WHY the module is pinned, and take
   `now` as a fixed ISO string — never the wall clock or fake timers." Also bumped the
   stated suite size (99 → 166). Reason: every future session that adds a test needs it,
   and it must ship with a clone; this file dies with the task and memory is per-machine.
2. **Path → this task file (Handoff → Files that matter)** — the two new test files plus
   the persisted-diff and workflow-transcript paths under `~/.claude/projects/…`. Reason:
   they matter only until the commit lands, then git is the record; a session-scoped path
   in CLAUDE.md or memory would rot within a week.
3. **Decision-with-reason → auto memory** (`long-session-recovery-pattern.md`) — "keep
   long-task state in a root checklist re-injected by the compact hook; delegate verbose
   ops for summaries only", with the verification that the compact matcher fires right
   after a manual `/compact` and the 20k-vs-185k measurement. Reason: it is about how
   Chetan and Claude work together across sessions, not about the code; the hook itself
   is in the repo but the evidence and the working preference are not, and pushing a
   personal working style into CLAUDE.md would impose it on every collaborator.
