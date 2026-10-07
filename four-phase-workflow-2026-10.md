# Four-Phase Workflow — 2026-10-07

Exercise: *Run the Four-Phase Workflow* (Specify → Plan → Tasks → Implement). Peer-run:
Chetan asked for a **developer agent** to do the work while this session acted as the
**peer reviewer** (gatekeeper for each phase, staged review, commit).

Subject: bug report, verbatim — *"Notes feature is not working properly. At a time I am able
to enter single character only and then cursor is out of box."*

## Artefacts

| Phase | Artefact | Produced by |
|---|---|---|
| 1 Specify | `specs/001-notes-focus-loss/spec.md` — 3 user stories, 12 Given/When/Then scenarios, EARS requirements NOTES-1..7, 6 verifiable success criteria | developer agent |
| 2 Plan | `specs/001-notes-focus-loss/plan.md` — root cause with file:line mechanism + ruled-out candidates, fix-location argument, files-to-touch table, 8 named risks, Constitution Check, 5 verifiable criteria | developer agent, 3 peer adjustments |
| 3 Tasks | `specs/001-notes-focus-loss/tasks.md` — T1 (fix + regression test + SPEC.md NOTES group), T2 (pin tag input / Tab trap / Escape / blur-commit), T3 (QuickAdd tag picker, optional) | developer agent, renumbered after adjustment A |
| 4 Implement | T1 only. Commit: `efc7b19` | developer implemented + staged; peer reviewed + committed |

## Root cause (from the plan, verified independently by the peer before reading it)

`components/Popover.tsx` ran initial focus and the outside-click listener in ONE
`useLayoutEffect` keyed `[open, anchor, onClose]`. `TaskEditPopover` recreates `close` every
render and passes it as `onClose`, so each keystroke in Notes (`setNotesDraft`) changed the
dep, re-ran the effect, and focused the `[data-autofocus]` priority button. Fix: two effects —
initial focus keyed `[open]`, listener keyed `[open, anchor, onClose]` (kept on purpose: `close`
captures `notesDraft`, a stale closure would commit stale notes). Same latent defect existed in
the "Add a tag" input and in QuickAdd's tag picker; fixing the shared component covers all three.

## Evaluate

**Does any plan step say "figure out later"?** No. The plan names the mechanism per keystroke
with line numbers, lists what was *ruled out* (`lib/keyboard.ts` early-return, `TaskRow`
pointer filter, the positioning effect), and argues the fix location from a grep of the
component's three consumers. Nothing was left to discover during implementation — and the
implementation had zero deviations from the plan.

**After task 1, does the spec still match the code?** Yes. NOTES-1/2/4/7 are what the two
effects now do; NOTES-5/6 describe untouched code paths. One honest caveat: the SPEC.md heading
says the NOTES group is "pinned in `taskEditPopover.test.tsx`", but after T1 only the
continuous-typing + initial-focus scenario is tested; NOTES-3 (tag input), the Tab trap, Escape
and blur-commit are *behaviourally* satisfied but their tests are T2. That is a coverage gap
scheduled in the task list, not spec/implementation drift — nothing in the spec is wrong.

**One strength of the generated plan.** It went beyond the reported symptom to the component
invariant: "a Popover whose initial focus runs on every `onClose` identity change is a defect
of the component, not of its caller", backed by the grep showing QuickAdd's tag picker had the
same latent bug. A local patch in `TaskEditPopover` would have passed the bug report and left
two other inputs broken.

**One weakness / missing consideration.** The plan split the SPEC.md amendment into its own
commit (old T2) while quoting SPEC.md's own rule that behaviour changes carry their spec lines
"in the same diff as the code" — it cited the rule and then violated it, rationalised as
"small commits". It also listed `npm run lint` as a success gate without having run it; oxlint
cannot execute on this machine (missing native binding, Node 20.12.2), so that criterion was
unverifiable as written.

**Adjustments made before implementation (peer → developer).**
- A. Fold the SPEC.md NOTES group into T1's commit; delete old T2; renumber T3→T2, T4→T3.
- B. Replace `npm run lint` with `npx tsc -p tsconfig.app.json --noEmit` everywhere; record
  oxlint's unavailability as a plan risk.
- C. Correct the baseline note: the row-interaction test failed deterministically on
  2026-09-30 and passes on 2026-10-07 — likely date-dependent, out of scope.
- D. (peer process, not in the plan) `Popover.tsx` had never been committed, so T1 would have
  landed as a 133-line "new file". Baseline-committed the reconstructed pre-fix file first so
  the fix is a 20-line readable diff — the same move as for SPEC.md on 2026-09-30.

## Verify

- **Red → green, confirmed by both parties.** Developer: test written first, failed with
  `Received: C` (focus on the "Medium" radio after one keystroke). Peer: swapped the pre-fix
  file back in, ran the new test → failed; restored the fix → passed.
- **Suite:** 9 files, 174/174 (baseline 173 + 1). `tsc --noEmit` clean.
- **Staged review:** `REVIEW: CLEAN` from the read-only `reviewer` agent — it assessed the four regression
  questions (initial focus timing, `onClose` in listener deps, Escape/Tab/outside-click unchanged,
  `[open]`-only deps completeness) and the test conventions; 0 findings.
- **Commit landed:** `efc7b19` — exactly `SPEC.md`, `components/Popover.tsx`,
  `test/taskEditPopover.test.tsx`. Planning docs + this write-up: the `docs:` commit immediately after `efc7b19`.
- **Manual check still owed (spec SC-005/006):** `npm run dev`, open a task's popover, type
  "hello world" into Notes → full text, focus stays; reload → persisted. Type "travel" +
  Enter in the tag input → `#travel` chip.
- **Can a peer predict task 2?** Yes: T2 names the five tests, their queries, their assertions
  and the expected suite total (179).

## Notes for the lesson

- Phases converted ambiguity to commitment in a measurable way: the bug report had one
  sentence; the spec had 12 scenarios; the plan had zero open questions; T1 had zero deviations.
- The peer's value was not finding the bug (the developer did that well) — it was holding the
  plan to the repo's existing rules (spec-anchored commits) and to what is actually runnable
  here (lint). Both are things a developer deep in the fix tends to rationalise away.
