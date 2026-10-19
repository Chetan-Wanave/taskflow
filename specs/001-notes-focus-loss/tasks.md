# Tasks: Notes field keeps focus while typing

**Input**: `specs/001-notes-focus-loss/spec.md`, `specs/001-notes-focus-loss/plan.md`

**Format**: `[ID] [P?] [Story]` — `[P]` = independent files, can run alongside the previous task. Each task is one Claude Code session and one commit; the full frontend suite must be green after each.

**Baseline**: 173/173 passing (`cd frontend && npx vitest run --reporter=dot`). Static gate: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (oxlint cannot run on this machine).

**Peer-review adjustments 2026-10-07**: SPEC.md amendment folded into T1 (SPEC's "same diff as the code" rule); `npm run lint` replaced by `tsc --noEmit`; former T3→T2, T4→T3.

---

## T1 [US1] Fix Popover initial-focus effect + regression test + SPEC.md NOTES group

**Files**
- `frontend/src/components/Popover.tsx` (modify)
- `frontend/src/test/taskEditPopover.test.tsx` (new)
- `SPEC.md` (modify — Behaviour requirements section)

**Exact change**
1. Write the test first. New file with header comment:
   `// Regression: Popover's initial-focus effect was keyed on onClose, whose identity changes on every consumer render; each keystroke in Notes re-ran it and moved focus to the Priority button, so only one character could be typed (bug report 2026-10-07). Pinned so the popover never moves focus on re-render.`
   Copy `makeTask`/`seed` from `rowInteractions.test.tsx`, replacing `new Date().toISOString()` with the constant `'2026-10-07T00:00:00.000Z'`. One test:
   - **"typing several characters in Notes keeps focus and the full draft"**: seed one task `{ title: 'Buy', priority: 'MEDIUM' }`; `render(<TaskList />)`; `user.click(getByRole('button', {name: 'Edit task (E to rename)'}))`; `await findByRole('dialog')`; assert `document.activeElement` is `getByRole('radio', {name: 'Medium'})` (initial focus guard); `user.click(getByLabelText('Notes'))`; `user.type(notes, 'Call the venue')`; assert `toHaveValue('Call the venue')` and `document.activeElement === notes`.
2. Run `npx vitest run src/test/taskEditPopover.test.tsx` → must FAIL with value `"a"`.
3. In `Popover.tsx`, replace lines 59-76 with two effects:
   - `// Initial focus — once per open, never on re-render.` `useLayoutEffect(() => { if (!open) return; const panel = panelRef.current; if (!panel) return; const first = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel.querySelector<HTMLElement>(FOCUSABLE); (first ?? panel).focus() }, [open])`
   - `// Outside-click dismissal. onClose stays in deps on purpose: consumers close over draft state.` `useLayoutEffect(() => { if (!open) return; const onPointerDown = …(verbatim lines 68-73)…; document.addEventListener('pointerdown', onPointerDown, true); return () => document.removeEventListener('pointerdown', onPointerDown, true) }, [open, anchor, onClose])`
4. Re-run the single test → GREEN.
5. In `SPEC.md`, after the SRCH group's acceptance scenarios and before `## Canonical data model`, add
   `### NOTES — Task edit popover focus (added 2026-10-07; pinned in frontend/src/test/taskEditPopover.test.tsx)`
   followed by NOTES-1 … NOTES-7 copied verbatim from `spec.md` → Functional Requirements, then an `Acceptance scenarios:` list with items 1-6 taken from spec.md US1-1, US2-1, US3-1, US3-2, US3-4, US3-5 (plain Given/When/Then prose, SRCH style). No other SPEC lines change.

**Verify**: `cd frontend && npx vitest run --reporter=dot` → 174 passed; `npx tsc -p tsconfig.app.json --noEmit` → clean; `grep -n "NOTES-7" SPEC.md` → one line. Manual: dev server, type "hello world" in Notes, full text visible, focus stays.

**Stage** (only these three): `git add frontend/src/components/Popover.tsx frontend/src/test/taskEditPopover.test.tsx SPEC.md`. Do not stage `specs/`; leave the pre-existing index entries for `frontend/src/domain/dates.ts` / `position.ts` alone.

**Commit**: `fix(frontend): popover no longer steals focus on re-render — Notes accepts continuous typing (SPEC NOTES-1..7)`

**Status**: DONE 2026-10-07 (staged, awaiting peer's review + commit)
- Red: `npx vitest run src/test/taskEditPopover.test.tsx` → 1 failed — `Expected the element to have value: Call the venue / Received: C` (focus had moved to the "Medium" priority button after the first keystroke).
- Green after Popover.tsx split: same file → 1 passed.
- Full suite: `npx vitest run --reporter=dot` → 9 files, **174 passed, 0 failed** (baseline 173 + 1).
- `npx tsc -p tsconfig.app.json --noEmit` → exit 0.
- SPEC.md: `### NOTES` group at line 92, NOTES-1..7 + 6 scenarios, before `## Canonical data model`.
- Staged: `frontend/src/components/Popover.tsx`, `frontend/src/test/taskEditPopover.test.tsx`, `SPEC.md` only.

---

## T1b [US3] Gate remediation: initial focus must wait until the panel is visible

**Added at review gate 2026-10-18** (see `plan.md` → Amendment, `review-gate-2026-10.md`). **Depends on**: T1 (committed as `efc7b19`; the T1 "staged, awaiting review" status above is stale). **Must land before T2** — T2's Tab-wrap tests assume focus starts inside the dialog.

**Files**
- `frontend/src/test/taskEditPopover.test.tsx` (modify — one test)
- `frontend/src/components/Popover.tsx` (modify — focus effect deps)

**Exact change**
1. Test first: **"initial focus is applied while the panel is visible"** — `vi.spyOn(HTMLElement.prototype, 'focus')` recording `getComputedStyle(this).visibility` per call; open the popover; assert the call that targeted the Medium radio saw `'visible'` and the final `activeElement` is that radio. Must FAIL on current code (call sees `'hidden'`).
2. In `Popover.tsx`: `const placed = pos !== null`; focus effect → `if (!open || !placed) return …` with deps `[open, placed]`.
3. Re-run the single test → GREEN; whole suite → 175 passed; `tsc` clean.
4. Manual, real browser: click Edit → `document.activeElement` is the selected priority button (SC-007); type "hello world" in Notes still works.

**Commit**: `fix(frontend): popover initial focus waits until panel is visible (SPEC NOTES-4, SC-007)`

**Status**: DONE 2026-10-19
- Red: new test failed — `.focus()` on the Medium radio saw `visibility: hidden`.
- Green after `[open, placed]` change; full suite 9 files, **175 passed**; `tsc -p tsconfig.app.json --noEmit` exit 0.
- Real browser (`npm run dev`, API mode, read-only probe): click Edit → `activeElement` = "Low" radio (`aria-checked=true`) inside the dialog (was `BODY`); real keypresses `a`,`b`,`c` in the tag input → value `abc`, focus kept.

---

## T2 [US2, US3] Pin the rest of the popover contract: tag input, focus trap, Escape, blur commit

**Depends on**: T1 (same test file).

**Files**
- `frontend/src/test/taskEditPopover.test.tsx` (modify — append tests)

**Exact change** — five tests added in the same `describe`:
1. **"typing in the Add-a-tag input keeps focus and the full draft"**: click `getByPlaceholderText('Add a tag and press Enter')`, `user.type(input, 'travel')`, assert value `'travel'` and `activeElement === input`; then `user.keyboard('{Enter}')`, `waitFor` → `useAppStore.getState().tags` has one tag named `'travel'` and `tasks[0].tagIds` contains its id; input value `''`; dialog still present.
2. **"Tab from the Notes textarea wraps to the first priority button"**: focus Notes via click, `user.tab()`, assert `activeElement` is `getByRole('radio', {name: 'None'})`.
3. **"Shift+Tab from the first priority button wraps to the Notes textarea"**: `getByRole('radio', {name: 'None'}).focus()`, `user.tab({shift: true})`, assert `activeElement` is the Notes textarea.
4. **"Escape commits the Notes draft, closes the popover, and returns focus to the Edit button"**: type `'Bring ID'` into Notes, `user.keyboard('{Escape}')`, assert `queryByRole('dialog')` is null, `waitFor` → `tasks[0].notes === 'Bring ID'` and the `todo.app.v2` envelope's `tasks[0].notes === 'Bring ID'`, `activeElement` is the Edit button.
5. **"blurring the Notes textarea commits the draft without closing the popover"**: type `'  '` (whitespace only) into Notes on a task with notes `null`, `user.tab()`, assert dialog still present and `tasks[0].notes === null` (trim→null, no write); then type `'Keep'`, `user.tab()`, `waitFor` → `tasks[0].notes === 'Keep'`.

6. *(gate)* **"pointer-down outside commits the Notes draft and closes the popover"**: type `'Call'`, `user.pointer` down on `document.body`, assert dialog gone and `tasks[0].notes === 'Call'` (NOTES-5, US1-4, US3-5).
7. *(gate)* **"clicking a tag chip, Due date button or priority button keeps focus on that control"** (US3-6): seed one tag; click each, assert `activeElement` is the clicked control.
8. *(gate)* **"a store re-render while typing keeps focus and the draft"** (NOTES-7): type `'ab'` in Notes, toggle a priority via `useAppStore.getState().patchTask(...)` from outside, type `'c'`, assert value `'abc'` and focus still on Notes.
Test 4 additionally spies `patchTask` and asserts exactly **one** call for the Escape path (suspected double commit; if it fails, fix `commitNotes`/`close` in a separate task, do not widen T2).

**Verify**: `cd frontend && npx vitest run --reporter=dot` → 183 passed (174 + T1b 1 + T2 8); `npx tsc -p tsconfig.app.json --noEmit` → clean.

**Commit**: `test(frontend): pin task edit popover focus trap, Escape, blur-commit and tag input`

---

## T3 [P] [US2] Cover the second Popover consumer: QuickAdd tag picker (optional)

**Depends on**: T1 (fix). Independent of T2 (different file).

**Files**
- `frontend/src/test/quickAdd.test.tsx` (new)

**Exact change**: header comment: `// Pinned because QuickAdd's tag picker shares components/Popover with the task edit popover and had the same latent focus-steal: with at least one existing tag, the first focusable control is a tag button, so typing in "New tag" lost focus after one character.` Seed store with one tag `{ id, name: 'work', color: null }` and no tasks (use the same fixed ISO `now`). `render(<QuickAdd />)`; click the composer input (`[data-quickadd-input]`, placeholder "Add a task…"), click the `Tags` button, `await findByRole('dialog')`, click `getByPlaceholderText('New tag, press Enter')`, `user.type(input, 'travel')`, assert value `'travel'` and `activeElement === input`.

**Verify**: `cd frontend && npx vitest run --reporter=dot` → 180 passed; `npx tsc -p tsconfig.app.json --noEmit` → clean.

**Commit**: `test(frontend): pin QuickAdd tag-picker input keeps focus while typing`

---

## Dependencies & order

T1 → T2; T3 may run any time after T1. Stop after T1 if only the user-visible fix is wanted — it is complete and shippable on its own.
