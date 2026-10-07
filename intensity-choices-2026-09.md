# Intensity choices — 2026-09-30

Exercise: *Choose Your Intensity* (Intensity Levels — Two Primary, One Horizon).
Repo: Taskflow (`/Users/chewan/Desktop/TODO`). Saved conversation: three real tasks, the
intensity chosen for each **before** doing the work, sync-direction reasoning, and a log of
the one task that was actually run.

Vocabulary used below:
- **no-spec** — code + test only; the spec is not touched because it already says the right thing.
- **spec-anchored** — SPEC.md lives beside the code and the *same commit* that changes behaviour
  carries the spec diff (EARS requirement lines + Given/When/Then acceptance scenarios).
- **spec-first** — complete, reviewed spec before any code (here: speckit `/speckit-specify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`).
- **Sync direction** — *static*: spec → code, one way, drift is human-managed. *living*: a tool
  watches both artefacts and propagates or flags changes in either direction.

EARS patterns (Easy Approach to Requirements Syntax) used for requirement lines:
ubiquitous `THE <system> SHALL …`; event-driven `WHEN <trigger>, THE <system> SHALL …`;
state-driven `WHILE <state>, THE <system> SHALL …`; unwanted-behaviour
`IF <condition>, THEN THE <system> SHALL …`; optional-feature `WHERE <feature>, …`.
Acceptance scenarios use `Given / When / Then` (the grammar speckit's `spec-template.md`
already uses under "Acceptance Scenarios").

---

## 1. Investigate — three real tasks, intensity decided up front

### Task 1 — Bug fix, root cause already known
**Reorder while a filter/search is active computes neighbours from the *visible* list.**

Evidence (all read, not guessed):
- `frontend/src/store/useAppStore.ts` `moveTask` derives `prev`/`next` from
  `selectVisibleTasks(state)` and, on the renormalize branch, calls
  `renormalize(reordered.map(t => t.id))` over the *visible* ids only.
- `frontend/src/features/tasks/TaskList.tsx` feeds `SortableContext` the visible ids and does
  not disable DnD while filtering; `moveTaskBy` (Alt+Arrow) has the same shape.
- Concrete failure: positions A=1024 (active), B=1536 (completed → hidden under the Active
  filter), C=2048, D=3072. Drag D between A and C → `midpoint(1024, 2048) = 1536`, which
  collides with hidden B; `sortByPosition` now has a tie and the order between B and D is
  undefined. Worse, a renormalize while filtered rewrites only the visible ids to
  `(i+1)*1024`, interleaving hidden tasks arbitrarily. Same code path in both storage modes.

**Intensity: no-spec.**
*Reason:* SPEC.md already states the invariant (drop = midpoint of the two neighbours in a
persisted sparse ordering); the code violates it, so nothing in the spec changes — the
deliverable is the fix plus a regression test, and a spec diff would be pure noise.

*Boundary note:* there are two fixes. (a) Compute neighbours from the full position-sorted
list and renormalize the whole list — invisible to users, stays no-spec. (b) Disable reorder
while a filter or search is active — user-visible, so the task flips to **spec-anchored**
(a `REORD-n` EARS line: `WHILE a filter or search is active, THE frontend SHALL disable
drag and Alt+Arrow reorder`). Same bug, two fixes, two intensities.

*Sync direction wanted: static* (trivially — no spec edit exists to propagate). A living
tool would propose spec edits for a pure fix, which is noise.

Also observed while baselining: `src/test/rowInteractions.test.tsx › Enter on the row
checkbox toggles completion` fails deterministically (165/166, three runs). Root cause
**unknown**, so it is *not* eligible for the no-spec bucket — investigate first, decide after.

### Task 2 — New feature touching one or two files
**Search matches `notes` as well as `title`.**

Today `selectVisibleTasks` (`frontend/src/store/selectors.ts`) tests
`task.title.toLowerCase().includes(query)` only. Notes exist on every task (`string | null`,
≤ 10 000 chars) and are shown as a "notes" hint on the row, but are unsearchable. Code
footprint: one selector + one new test file.

**Intensity: spec-anchored.**
*Reason:* the behaviour is user-visible and SPEC.md's search line ("debounced client-side
text search") is silent on *what* search covers, so the commit must carry the rule or the
next developer "fixes" it back to title-only as a perf tweak.

*What the spec update in the commit looks like* (this is the "can you describe the diff?"
test — if I could not write these before coding, spec-anchored would have collapsed into
no-spec):

1. Revised constraint — feature-set line: "…debounced client-side text search **over title
   and notes**… Search semantics pinned under Behaviour requirements → SRCH."
2. New EARS lines (new section `## Behaviour requirements (EARS + acceptance scenarios)`):
   - `SRCH-1 (event-driven): WHEN the user enters a non-blank search query, THE frontend
     SHALL show only tasks whose title OR notes contain the trimmed query as a
     case-insensitive substring.`
   - `SRCH-2 (state-driven): WHILE a search query is active, THE frontend SHALL still apply
     the status filter and the tag filter — the three are AND-ed.`
   - `SRCH-3 (unwanted): IF a task's notes are null, THEN THE frontend SHALL match on the
     title alone and SHALL NOT raise or treat the task as matching.`
   - `SRCH-4 (ubiquitous): THE search query SHALL be view-state — never persisted and never
     sent to the backend. The REST GET /tasks?search= parameter stays title-only in v1 and
     is not used by ApiAdapter; widening it is a separate, cross-layer change.`
3. New Given/When/Then scenarios (six), e.g. `Given a task titled "Book flights" with notes
   "Use the Amex voucher", When the user searches "voucher", Then the task is visible.` and
   `Given a task titled "Water plants" with null notes, When the user searches "voucher",
   Then the task is hidden and no error is raised.`
4. Revised constraint — REST contract line for `GET /tasks` gains
   "search= is title-only and unused by ApiAdapter — client search is view-state, see SRCH-4".

*Sync direction wanted: living.* `selectors.ts` and the SRCH block describe the same
semantics in two artefacts with no build-time link — the behavioural twin of the five-layer
data-model problem that `/contract-check` exists for. A watcher that flags "selectors.ts
changed but SRCH did not (or vice-versa)" is exactly what would keep this from drifting.

### Task 3 — Cross-team surface area / compliance implications
**Real user accounts: Spring Security + token header replacing the `CurrentUser` stub.**

Surface: frontend (login screen, token storage, `ApiAdapter` auth header, error toasts for
401/403), backend (security filter chain, `CurrentUser` resolution, per-user isolation of
*every* query including export/import and clear-completed), DB (Flyway `V2`: password hash
column, `users.email` becomes real PII, token/session table), and compliance (credential
hashing policy, session expiry, per-user data export/erasure). SPEC.md Phase C already names
the `CurrentUser` stub as "the auth seam".

**Intensity: spec-first** (speckit: `/speckit-specify` → `specs/001-user-accounts/spec.md`,
then `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`).
*Reason:* every one of the five layers plus a reviewer outside the team touches it, and the
reviewed document is the artefact a security/compliance sign-off attaches to — so it must be
complete and frozen before code exists.

*Sync direction wanted: static.* A frozen, reviewed spec is the point: living sync would let a
code change silently rewrite the document a compliance reviewer approved. Code conforms to
the spec; changes go through a spec amendment and re-review.

---

## 2. Evaluate

**Where spec-first feels like overhead.** Tasks 1 and 2. A full speckit spec/plan/tasks cycle
for a ten-line selector change costs more than the change and produces a document nobody
re-reads. The signal: the number of people who must agree is one.

**Where no-spec feels reckless.** Task 3, obviously. But also Task 2: an undocumented
"search also matches notes" rule is exactly what gets reverted as a "perf fix" or implemented
differently by the backend team. Task 2 sits on the boundary — that is the productive zone.

**Spec-anchored collapse test.** I wrote the four SRCH lines and six scenarios *before*
touching `selectors.ts`. That worked, so the choice held. Had the best I could write been
"update the search description", it would already have collapsed into no-spec.

**Sync direction summary**

| Task | Intensity | Sync | Why |
|---|---|---|---|
| 1 Filtered-reorder bug | no-spec | static | nothing to propagate; a living tool adds noise |
| 2 Search matches notes | spec-anchored | living | two artefacts, same semantics, no build-time link |
| 3 User accounts / auth | spec-first | static | reviewed & signed-off doc must not be rewritten by code |

Pattern: sync direction is not a function of intensity. The middle intensity wants the
*most* tooling, because that is where spec and code are edited by the same person in the
same hour and drift is cheapest to introduce.

---

## 3. Verify — ran Task 2 at spec-anchored

### What was done, in order
1. **Pre-condition failed:** `SPEC.md` and `frontend/src/store/selectors.ts` were both
   *untracked* in git (only the harness and two test files were committed). A spec-anchored
   commit has nothing to diff against if the spec is not in version control. Committed both
   verbatim first → `233f3b5 chore: track SPEC.md and store/selectors.ts baseline`.
2. **Baseline tests:** `npx vitest run` → 7 files, 165/166 (the one failure is the
   pre-existing `rowInteractions` case noted under Task 1).
3. **Spec first, then code:** wrote the SRCH block + the two revised constraint lines in
   SPEC.md, then a 10-line `matchesQuery` helper in `selectors.ts`, then
   `frontend/src/test/selectors.test.ts` (7 tests, one per SRCH scenario plus a
   position-order pin; fixed ISO timestamps, header comment on WHY, per repo convention).
4. **Checks:** vitest → 8 files, 172/173 (same single pre-existing failure); `tsc -p
   tsconfig.app.json --noEmit` clean. `npm run lint` cannot run — oxlint's native binding is
   missing from `node_modules` (npm optional-dependency bug, environment issue, pre-existing).
5. **Review:** staged the three files, ran `/review-changes` → read-only `reviewer` agent.
   Result: `REVIEW: CLEAN` — 0 findings across eight checks (five-layer contract untouched, safety
   invariants, dates rule, tests-move-with-behaviour, SPEC internal consistency, and every
   one of the six acceptance scenarios mapped to a test). The `reviewer` agent type loaded
   this time (it did not on 2026-09-07 — see task-checklist D6).
6. **Commit:** `0cdbc0c feat(frontend): search matches notes as well as title (SPEC SRCH-1..4)` —
   exactly three files: `SPEC.md` (+22/−3), `selectors.ts` (+10/−1), `selectors.test.ts`
   (+93). That diff *is* the spec-anchored artefact: spec lines and code in one commit.
   Local only, not pushed.

### Where the chosen intensity helped
- **Writing SRCH-4 forced the question "what about `GET /tasks?search=`?"** Checked
  `TaskRepository.findFiltered` — its JPQL matches `lower(t.title)` only. The adapter never
  sends the param (search is view-state), so I *chose* to leave the REST param title-only
  and wrote that down as a constraint instead of leaving a silent frontend/backend
  divergence. No-spec would have shipped the divergence unnoticed.
- **Writing SRCH-3 (null notes) produced a test case** I would probably have skipped.
- **Writing SRCH-2 made me test the AND with the tag filter**, not just the status filter.
- The 10-line code diff is now self-explaining: the helper's doc comment points at SRCH-1/3.

### Where it hurt
- SPEC.md had no home for behavioural requirements — every section is structural (data
  model, REST, CSS tokens). Inventing the `## Behaviour requirements` section was a one-time
  cost the first spec-anchored commit had to pay.
- Ratio: ~20 lines of spec for ~10 lines of code. Heavy for this feature; amortises as the
  section grows.

### Where it had no effect
- The production code itself. I would have written the same helper at any intensity. The
  intensity changed *what was tested* and *what was documented*, not what was built.

### Side-effects surfaced by doing it properly
- Spec not in git (fixed), no behavioural section in the spec (fixed), lint tool broken
  (not fixed), one pre-existing failing UI test (not fixed).

---

## Follow-ups (not done here — scope discipline)
- **Task 1 bug is real and unfixed.** Fix (a) — neighbours from the full sorted list,
  renormalize the full list — plus a store-level regression test. Still no-spec.
- **`rowInteractions.test.tsx` failure** — root-cause first; intensity decided after.
- **oxlint** — `rm -rf node_modules package-lock.json && npm i` in `frontend/` per the error text.
- **Decision for Chetan to confirm:** SRCH-4 keeps `GET /tasks?search=` title-only. If the
  REST param should also match notes, that is a small backend change (`TaskRepository`
  JPQL + one integration test) and SRCH-4 / the REST line get revised in that commit.
