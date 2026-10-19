# Implementation Plan: Notes field keeps focus while typing

**Branch**: `001-notes-focus-loss` (no git branch created yet) | **Date**: 2026-10-07 | **Spec**: `specs/001-notes-focus-loss/spec.md`

## Summary

Each keystroke in the Notes textarea re-runs the shared `Popover`'s initial-focus effect, which yanks focus to the Priority button. Fix: in `Popover.tsx`, split the combined "initial focus + outside-click" layout effect so that initial focus runs only when `open` flips to true, while outside-click subscription keeps its current deps. Pin with a component test and add the `NOTES` behaviour group to SPEC.md in the same commit.

## Technical Context

**Language/Version**: TypeScript strict, React 19.2, Vite 6 · **Primary deps**: react, react-dom, zustand, @dnd-kit (unchanged) · **Storage**: localStorage adapter (default); fix is storage-agnostic · **Testing**: vitest 3 + jsdom + @testing-library/react + user-event (existing devDeps) · **Baseline**: `cd frontend && npx vitest run --reporter=dot` → **8 files, 173 passed, 0 failed** on 2026-10-07 (the "Enter on the row checkbox toggles completion" test failed deterministically on 2026-09-30 (3 runs) and passes on 2026-10-07 (developer's run + peer's run) — likely date-dependent; out of scope, do not touch).

## Root cause (confirmed)

**Mechanism — one keystroke in Notes:**

1. `TaskEditPopover.tsx:182` — `onChange` → `setNotesDraft(value)` → `TaskEditPopover` re-renders.
2. `TaskEditPopover.tsx:43` — `const close = () => {...}` is recreated on every render → new function identity.
3. `TaskEditPopover.tsx:72` — `<Popover ... onClose={close}>` → `Popover` receives a new `onClose` prop.
4. `Popover.tsx:60-76` — a single `useLayoutEffect` does BOTH initial focus (`:64-66`, `(first ?? panel).focus()`) AND the outside-click listener, with deps `[open, anchor, onClose]` (`:76`). Because `onClose` changed, the cleanup runs and the effect re-executes.
5. `:64` finds `[data-autofocus]` = the currently selected priority button (`TaskEditPopover.tsx:94`) and calls `.focus()` → focus leaves the textarea after the first character. The second keystroke goes to a `<button>`, so nothing is typed.

**Evidence:** reproduced 2026-10-07 with a throwaway component test (not kept): after `user.type(notes, 'abc')`, `notes.value === 'a'` and `document.activeElement` is `<button>None</button>`. The "Add a tag" input (`TaskEditPopover.tsx:156-168`, `setNewTag` at `:161`) fails identically. `TaskRow.tsx:208` also passes an inline `onClose={() => setPopoverOpen(false)}`, so even memoising `close` in `TaskEditPopover` would not help: `close` closes over `notesDraft` (changes per keystroke) and over an `onClose` that changes per row render.

Not the cause (ruled out by reading): `lib/keyboard.ts:43` returns early for any target inside `[role="dialog"]`; `TaskRow.onRowPointerDown` filters textarea targets; the first positioning effect (`Popover.tsx:34-57`) only calls `setPos`, never `.focus()`.

## Where to fix: shared `Popover` vs local `TaskEditPopover`

**Decision: fix in `components/Popover.tsx`.**

- `grep "<Popover"` → three consumers: `TaskEditPopover.tsx:72`, `QuickAdd.tsx:181` (due picker), `QuickAdd.tsx:197` (tag picker). All three pass an inline `onClose`. QuickAdd's tag picker has an `<input>` whose `onChange` calls `setNewTagName` (`QuickAdd.tsx:214`) — the same latent bug, visible as soon as one tag exists (first focusable becomes a tag button). A local fix would leave it.
- A `Popover` whose initial-focus runs on every `onClose` identity change is a design defect of the component, not of its caller; the fix belongs where the invariant is broken.
- Local alternatives rejected: `useCallback(close)` is defeated by `notesDraft` and the inline `TaskRow` `onClose`; a "latest-callback ref" in `TaskEditPopover` fixes one consumer only and adds a pattern the codebase does not use (no `useCallback`/`useRef`-callback usage anywhere today).

## Files to touch

| File | Change | Why |
|---|---|---|
| `frontend/src/components/Popover.tsx` | Replace the single effect at `:59-76` with two: (a) `useLayoutEffect` keyed `[open]` that does only the `[data-autofocus] ?? FOCUSABLE ?? panel` focus (lines 62-67 moved verbatim); (b) `useLayoutEffect` keyed `[open, anchor, onClose]` that does only the `pointerdown` capture listener (lines 68-75 moved verbatim). Update the comment above each. | (a) initial focus must happen once per open, never per render. (b) deliberately KEEPS `onClose` in deps — `close` captures `notesDraft`, so a stale closure would commit stale notes; re-subscribing a document listener does not move focus and is cheap. No ref-ification. |
| `frontend/src/test/taskEditPopover.test.tsx` (new) | Header comment stating why the module is pinned (the mechanism above). Helpers `makeTask`/`seed` copied from `rowInteractions.test.tsx` but with a fixed ISO `now` string (`'2026-10-07T00:00:00.000Z'`), never the wall clock. Tests: see tasks.md T1 and T2. Queries: `getByRole('button', {name: 'Edit task (E to rename)'})`, `findByRole('dialog')`, `getByLabelText('Notes')`, `getByPlaceholderText('Add a tag and press Enter')`, `getByRole('radio', {name: 'Medium'})`. | CLAUDE.md: tests live in `src/test/`, open with a WHY header, fixed `now`. |
| `SPEC.md` → "Behaviour requirements (EARS + acceptance scenarios)" | Add a `### NOTES — Task edit popover focus (added 2026-10-07; pinned in frontend/src/test/taskEditPopover.test.tsx)` group after the SRCH group with NOTES-1..7 from spec.md and acceptance scenarios 1-6. No other SPEC section changes (data model, REST, DDL unaffected; the stale `test/` listing under Frontend architecture is pre-existing and not touched). **Same commit as T1.** | SPEC.md's own rule: "A commit that changes user-visible behaviour adds or revises lines here in the same diff as the code" — so the amendment ships in T1's commit, not separately. |
| `frontend/src/test/quickAdd.test.tsx` (new, optional T3) | Pin the QuickAdd tag-picker input with ≥1 seeded tag. | Second consumer of the same fix. |

Not touched: `TaskEditPopover.tsx`, `TaskRow.tsx`, `QuickAdd.tsx`, `lib/keyboard.ts`, any CSS, any `domain/`, adapters, backend, `legacy/`.

## Amendment — review gate 2026-10-18 (before T2)

**Defect in the shipped T1 design.** Plan said effect (a) keyed `[open]` "fires when `open` becomes true; `panelRef.current` is set by then exactly as today". True for the ref, false for visibility. On the opening commit `pos === null`, so the panel has `visibility: hidden` (`Popover.tsx:125`). Layout effects run in order: the positioning effect calls `setPos` (applies on the *next* render), then the focus effect calls `.focus()` on a still-hidden element, which browsers ignore. Old code only worked because the next render brought a new `onClose` and re-ran the effect. Verified 2026-10-18 on `npm run dev`: after clicking Edit, `activeElement` is `BODY`, dialog `visibility: visible`. jsdom passed because it does not apply the hidden-focus rule.

**Fix (new task T1b, below):** derive `const placed = pos !== null` and key the focus effect on `[open, placed]`, returning early unless both are true. `placed` flips once per open (`pos` is reset to `null` when closed), so it still cannot re-run on keystrokes, resize, or scroll (those change `pos` values, not `placed`). Effect (b) unchanged.

**Other plan gaps closed in tasks.md:** outside pointer-down commit (NOTES-5 / US3-5), click-keeps-focus (US3-6), and the draft/focus surviving a store re-render (NOTES-7) had no test. Added to T2 as tests 6-8. T2 test 4 also asserts the Escape path writes once (suspected duplicate commit: Escape → `close()` then `anchor.focus()` blurs the textarea, whose `onBlur` runs the same stale-closure `commitNotes` again — **unverified**, T2 will show it).

**Assumption now explicit:** panel visibility gating (see spec Assumptions).

## Risks

- **Initial autofocus regression** — effect (a) still fires when `open` becomes true; `panelRef.current` is set by then exactly as today (same `useLayoutEffect` timing). Pinned by the initial-focus assertion in T1.
- **Outside-click / Escape / focus-trap** — untouched code paths: `onKeyDown` at `Popover.tsx:80-103` is unchanged; the listener effect is moved verbatim with identical deps. Pinned by T3 tests.
- **Stale `onClose` in the listener** — avoided by keeping `onClose` in effect (b)'s deps (see table).
- **StrictMode double effects (dev)** — effect (a) runs twice on mount, focusing the same element twice; idempotent. Tests render without StrictMode, same as `rowInteractions.test.tsx`.
- **Known-flaky test** — "Enter on the row checkbox toggles completion" passed at baseline; if it fails during this work, it is unrelated (dnd-kit KeyboardSensor) and must not be "fixed" here.
- **Focus-on-click behaviour change** — after the fix, clicking a tag chip or the Due date button keeps focus on the clicked control instead of jumping to the Priority group. This is the intended behaviour (spec scenario US3-6), not a regression.
- **oxlint unavailable on this machine** (native binding missing / Node 20.12.2); `tsc -p tsconfig.app.json --noEmit` is the static gate. Its config has only `react/rules-of-hooks` anyway (no exhaustive-deps); the `[open]` deps array is genuinely complete (`panelRef` is a ref).

## Constitution Check (against CLAUDE.md; `.claude/.specify/memory/constitution.md` is an unfilled template)

- No new runtime or dev dependencies — PASS (vitest, RTL, user-event already present).
- Components use semantic CSS tokens only — PASS (no CSS touched).
- Tests in `frontend/src/test/`, WHY header comment, fixed `now` ISO string, no fake timers — PASS by construction (T1).
- Five-layer data model untouched; `/contract-check` not needed — PASS (no `domain/`, DTO, entity, or DDL change).
- `legacy/` and `todo-app-items` untouched — PASS.
- Spring Boot 3.5.3 / Gradle 8.14.2 unchanged — PASS (backend not touched).
- SPEC.md behaviour-requirements rule ("same diff as the code") — PASS: the NOTES group is part of T1's commit.

## Success criteria (verifiable)

1. `cd frontend && npx vitest run src/test/taskEditPopover.test.tsx` — RED before the `Popover.tsx` change (value `"a"`), GREEN after.
2. `cd frontend && npx vitest run` — 173 baseline tests still pass + new tests (T1 adds 1, T2 adds 5, T3 adds 1).
3. `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — exit 0 (oxlint cannot run on this machine; tsc is the static gate used in this repo).
4. Manual (dev server): type "hello world" in Notes → visible in full; click outside → reopen → still there; reload → still there. Type "travel" + Enter in the tag input → `#travel` chip on the row.
5. SPEC.md contains a `### NOTES` group whose pinned-test path exists on disk, and it lands in the same commit as `Popover.tsx` (`git show --stat HEAD` lists both).
