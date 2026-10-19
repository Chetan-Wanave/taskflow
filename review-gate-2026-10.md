# Review gate — specs/001-notes-focus-loss, before T2 (2026-10-18)

## What the gate caught

**1. T1's fix does not give initial focus in a real browser (high severity, shipped in `efc7b19`).**
The plan keyed the focus effect on `[open]` and assumed it would fire on a focusable panel. On the opening commit the panel is `visibility: hidden` (`pos === null`), and browsers ignore `.focus()` on hidden elements. The old code only worked because every re-render re-ran the effect. Probed on `npm run dev` with Playwright: after clicking Edit, `document.activeElement` was `BODY` while the dialog was `visibility: visible`. T1's test passed because jsdom does not enforce the hidden-focus rule. Mid-implementation of T2 this would have surfaced as a confusing failure (or not at all, since jsdom is green) — and SC-005's manual check only types in Notes, so it would not have noticed either.
*Change:* new task T1b (focus effect keyed on `[open, placed]`), new success criterion SC-007 (real-browser check + visibility-at-focus-time test), plan Amendment section.

**2. Spec requirements with no test anywhere in the plan.** NOTES-5 outside pointer-down commit, US3-6 click keeps focus, NOTES-7 store re-render preserves focus and draft.
*Change:* T2 tests 6–8.

**3. Suspected double commit on Escape (unverified).** `Popover.onKeyDown` calls `onClose()` (→ `commitNotes`) then `anchor.focus()`, which blurs the textarea and runs `onBlur={commitNotes}` from the same stale closure; `task.notes` is stale so the "unchanged → no write" guard may not trip. Not reproduced; T2 test 4 now asserts one `patchTask` call.

**4. Housekeeping drift.** tasks.md T1 still said "staged, awaiting review" though `efc7b19` is committed. Marked stale in T1b.

## Assumption identified (gate step 3)
The plan assumed the panel is focusable when the focus effect runs; the spec never states panel visibility gating. Decision: **amend spec** (Assumptions) and **amend plan**, not accept silently.

## Spec vs plan, side by side
- Every acceptance scenario now has a task covering it, except IME composition and multi-tab `storage` events (not testable in jsdom; accepted, noted).
- Nothing in the plan exceeds the spec. T3 (QuickAdd) is covered by the spec's last Assumption.

## Evaluate
- *Would I have caught it mid-implementation?* No. The only signal was a browser-only behaviour; all 174 tests were green.
- *Was it performative?* No: the "strongest objection" question pointed at what the plan took for granted about the effect timing; the finding was then checked empirically rather than argued.
- *Where gates are missing today:* the Plan → Implement boundary has none for "does a jsdom test stand in for the real runtime?". Highest-leverage addition: for any bug about focus, layout, or visibility, require one real-browser check (Playwright MCP is already wired in) in the task's Verify line before the commit.
