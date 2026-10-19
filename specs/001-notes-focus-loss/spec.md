# Feature Specification: Notes field keeps focus while typing (bug fix)

**Feature Branch**: `001-notes-focus-loss` (directory name; no git branch created in the Specify/Plan/Tasks phases)

**Created**: 2026-10-07

**Status**: Draft

**Input**: Product-owner bug report, verbatim: "Notes feature is not working properly. At a time I am able to enter single character only and then cursor is out of box."

Context: Notes are edited in the task edit popover (opened from a task row's Edit button). The same popover holds the Priority segmented control, the Due date control, the tag toggles, and an "Add a tag and press Enter" input. localStorage mode is the default runtime.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Type a full note in one go (Priority: P1)

A user opens a task's edit popover, clicks into Notes, and types a sentence. Every character lands in the textarea, the caret stays in the textarea, and the text is saved when they leave the field or close the popover.

**Why this priority**: This is the reported defect. Today only the first character is accepted; the field is effectively unusable, which breaks a should-have feature already shipped ("Notes field + task edit popover consolidation").

**Independent Test**: Open a task's popover, click Notes, type "Call the venue". Observable result: the textarea shows "Call the venue" and still has the caret.

**Acceptance Scenarios**:

1. **Given** a task with no notes and its edit popover open, **When** the user clicks the Notes textarea and types "Call the venue" without pausing, **Then** the textarea shows "Call the venue" and keyboard focus is still on the textarea.
2. **Given** a task whose notes are "Draft", **When** the user clicks at the end of Notes and types " v2", **Then** the textarea shows "Draft v2" and focus is still on the textarea.
3. **Given** the Notes textarea holds an uncommitted draft, **When** focus leaves the textarea (Tab, click elsewhere inside the popover), **Then** the task's notes equal the draft (trimmed-empty becomes null) in the store and in the `todo.app.v2` envelope.
4. **Given** the Notes textarea holds an uncommitted draft, **When** the popover is closed by Escape or by a pointer-down outside it, **Then** the draft is committed exactly as in scenario 3 and the popover is gone.

---

### User Story 2 - Type a tag name in the same popover (Priority: P2)

A user types a multi-character tag name into "Add a tag and press Enter" and presses Enter to create and attach it.

**Why this priority**: Same popover, same control family, same mechanism as the Notes defect; the owner has not reported it yet but it fails identically today.

**Independent Test**: In the popover, click the tag input and type "travel". Observable result: input shows "travel" and keeps focus; Enter creates and attaches the tag.

**Acceptance Scenarios**:

1. **Given** the edit popover open, **When** the user clicks the tag input and types "travel", **Then** the input shows "travel" and keyboard focus is still on the input.
2. **Given** the input shows "travel", **When** the user presses Enter, **Then** a tag named "travel" exists, is attached to the task, the input is empty, and the popover stays open.

---

### User Story 3 - Popover keyboard behaviour is unchanged (Priority: P2)

The fix must not loosen the popover's existing accessibility contract (SPEC.md "FOCUS & A11Y": focus trap + Escape in popover).

**Independent Test**: Open the popover from the keyboard and walk it with Tab / Shift+Tab / Escape.

**Acceptance Scenarios**:

1. **Given** a task with priority Medium, **When** its edit popover opens, **Then** keyboard focus is on the "Medium" priority button (the currently selected priority receives initial focus).
2. **Given** the popover open and focus on its last focusable control (the Notes textarea), **When** the user presses Tab, **Then** focus moves to the first focusable control inside the popover (the "None" priority button) and does not leave the popover.
3. **Given** the popover open and focus on its first focusable control, **When** the user presses Shift+Tab, **Then** focus moves to the last focusable control inside the popover.
4. **Given** the popover open with focus anywhere inside it, **When** the user presses Escape, **Then** the popover closes, any Notes draft is committed, and focus returns to the control that opened it (the row's Edit button), so the row remains the keyboard context.
5. **Given** the popover open, **When** the user presses the pointer down outside the popover and outside its Edit button, **Then** the popover closes and any Notes draft is committed.
6. **Given** the popover open, **When** the user clicks the Due date value button, toggles a tag chip, or clicks a priority button, **Then** focus stays on the control that was clicked (it does not jump to the Priority group).

### Edge Cases

- Store-driven re-renders while typing: a tag toggle, a priority click, a Due date change, or a multi-tab `storage` event re-renders the popover while the Notes draft is live. Focus and the draft must survive all of them.
- Whitespace-only notes are committed as `null`; an unchanged draft produces no write.
- Notes length is capped at 10,000 characters (existing `maxLength`); typing past the cap is ignored by the browser, focus still stays.
- IME composition in Notes (multi-keystroke characters) must not be interrupted by a focus move.
- Opening the popover when the task has priority NONE focuses the "None" button; when no `[data-autofocus]` match exists the first focusable control is focused (unchanged behaviour).
- React StrictMode (dev only) runs mount effects twice; initial focus landing twice on the same element is harmless and must stay so.

## Requirements *(mandatory)*

### Functional Requirements (EARS; id prefix `NOTES-`, for later copy into SPEC.md → Behaviour requirements)

- **NOTES-1** (ubiquitous): THE task edit popover SHALL keep keyboard focus on whichever control inside it currently has focus across any re-render of the popover or its parent row.
- **NOTES-2** (event-driven): WHEN the user types a character into the Notes textarea, THE frontend SHALL append that character to the Notes draft and SHALL leave focus and caret in the textarea.
- **NOTES-3** (event-driven): WHEN the user types a character into the "Add a tag" input, THE frontend SHALL append that character to the tag-name draft and SHALL leave focus in the input.
- **NOTES-4** (event-driven): WHEN the popover opens, THE frontend SHALL move focus once to the control marked for initial focus (the currently selected priority button), and SHALL NOT move focus again until the popover is closed and reopened.
- **NOTES-5** (event-driven): WHEN the Notes textarea loses focus, or the popover closes via Escape or outside pointer-down, THE frontend SHALL commit the Notes draft to the task (trimmed-empty → null; no write when unchanged).
- **NOTES-6** (state-driven): WHILE the popover is open, THE frontend SHALL trap Tab / Shift+Tab inside the popover (wrap last→first and first→last), and WHEN Escape is pressed SHALL close the popover and return focus to the control that opened it.
- **NOTES-7** (unwanted): IF the popover re-renders because of a store update (tag toggle, priority change, due-date change, multi-tab reconcile) THEN THE frontend SHALL NOT reset or move focus and SHALL NOT discard the Notes draft.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Component test "typing several characters in Notes keeps focus and the full draft" in `frontend/src/test/taskEditPopover.test.tsx` fails on the current code (textarea value `"a"`, focus on a priority button — reproduced 2026-10-07) and passes after the fix.
- **SC-002**: Component test "typing in the Add-a-tag input keeps focus and the full draft" passes.
- **SC-003**: Component tests for initial focus on the selected priority button, Tab wrap last→first, Shift+Tab wrap first→last, and Escape closing + committing + returning focus to the Edit button all pass.
- **SC-004**: `cd frontend && npx vitest run` reports every pre-existing test still passing (baseline 173) plus the new tests; `cd frontend && npx tsc -p tsconfig.app.json --noEmit` is clean.
- **SC-005**: Manual: `npm run dev`, open a task's popover, type "hello world" into Notes → the textarea reads "hello world"; click outside → reopen → Notes still reads "hello world"; reload the page → still "hello world" (persisted to `todo.app.v2`).
- **SC-006**: Manual: in the same popover, type "travel" into the tag input and press Enter → a `#travel` chip appears on the row.
- **SC-007** *(added at review gate 2026-10-18)*: Manual, **real browser (not jsdom)**: `npm run dev`, click a task's Edit button → `document.activeElement` is the selected priority button inside the dialog, not `<body>`. jsdom does not enforce "hidden elements cannot take focus", so SC-003's initial-focus test cannot stand in for this. Automated proxy: a component test that records `getComputedStyle(el).visibility` at the moment `.focus()` is called on the initial-focus target and asserts it is `visible`.

## Assumptions

- *(gate 2026-10-18)* The panel is rendered `visibility: hidden` until it has been positioned (`pos` set), and browsers refuse `.focus()` on a hidden element. "Focus once on open" therefore means once the panel is **visible**, not once the component mounts. Before the T1 fix this was masked: the initial-focus effect re-ran on the next render (new `onClose`) when the panel was already visible.
- "Cursor is out of box" means keyboard focus leaves the textarea (observed: it lands on the Priority group), not a visual/CSS caret issue.
- "Restores focus to the row" on Escape is satisfied by the existing behaviour of focusing the row's Edit button (the popover's anchor); changing that target is out of scope.
- The fix is frontend-only; the data model, adapters, REST contract, and SQL are untouched (notes are already persisted correctly once a draft commits).
- The QuickAdd composer's tag-picker popover shares the same component and the same latent defect (visible when at least one tag exists); it is covered by the same fix and is in scope for test coverage but is not the reported bug.
