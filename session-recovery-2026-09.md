# Session recovery — 2026-09-07 (exercise: "Keep a long session on the rails")

Two recovery events are recorded here. Part 1 is the `/compact` inside a running
session; Part 2 is a fresh session given nothing but the handoff from `task-checklist.md`.

## Part 1 — `/compact` mid-task, then "where were we?"

### Setup
- Task under way: direct unit tests for `frontend/src/domain/validation.ts` and
  `frontend/src/domain/mutations.ts` (see `task-checklist.md`).
- Hook under test (`.claude/settings.json`, SessionStart, `"matcher": "compact"`):
  ```sh
  f="${CLAUDE_PROJECT_DIR:-.}/task-checklist.md"; if [ -f "$f" ]; then
    echo '--- task-checklist.md re-injected by the SessionStart:compact hook. Read it, then continue from Current Status. ---'
    cat "$f"
  fi
  ```
- State at compaction: steps 0–4 checked, `validation.test.ts` written (37 tests,
  green, unstaged). `Current Status` in the checklist named step 5 as NEXT.
- Context before `/compact`: ~92k tokens (the reading taken after the delegated audit).

### What landed in the fresh context
Two `SessionStart:compact hook success` blocks, in this order:
1. The pre-existing no-matcher hook: `Taskflow reminder: run /review-changes on staged
   work before committing.` (It has no matcher, so it fires on every SessionStart event,
   compact included.)
2. The new compact hook: the banner line followed by the full `task-checklist.md`.

So the answer to the open question from earlier in the session ("does the `compact`
matcher fire right after a manual `/compact`, or only on a later resume?") is: it fires
immediately after `/compact`. The guide agent's caveat was wrong for this version.

### The exchange

**User:** where were we?

**Claude:** Steps 0–4 are done. `frontend/src/test/validation.test.ts` exists, passes
(37 tests), and is deliberately not staged yet. Next is **step 5: write
`frontend/src/test/mutations.test.ts`**, starting with `buildTask` because the audit found
it has zero coverage of any kind, direct or indirect. After that: step 6 (delegated full
run, summary only), step 7 (stage only the two new test files, then `/review-changes`),
step 8 (handoff and the three where-does-this-belong choices). The checklist also says to
save this exchange as `session-recovery-2026-09.md`, which is this file.

### Evaluation
- **Identified the next step unprompted:** yes. The question contained no hint about a
  checklist, a hook, or a step number.
- **Was it the hook or the compaction summary?** Both carried the state this time. The
  summary Claude Code produced was detailed enough on its own to name step 5. The hook's
  value is that it does not depend on summary quality: the checklist arrives verbatim,
  with the decisions (D1–D5) and the delegated findings intact, every time. It is the
  belt; the summary is the braces.
- **Degradation signals before compaction:** none observed. The session was at 9% of the
  window. Compaction was run for the exercise, not out of need.
- **What the checklist did not answer that a reader might want:** the exact `/context`
  numbers were in the checklist (step 1 line), but the *reason* the hook is guarded on
  file existence lived only in D5. Everything needed to continue was present.

## Part 2 — fresh session, handoff only

### What the fresh session received (2026-09-08, 16:36 local)
- The user message was the `## Handoff` section of `task-checklist.md` (lines 105–160),
  pasted verbatim, plus a one-line addendum: "makes 2 commits, 1 for tests + claude.md and
  one to exercise artifacts". Nothing else from the previous session's transcript.
- The two CLAUDE.md files and the auto-memory index arrived as usual via the system prompt.
- One `SessionStart:startup hook success` block: the no-matcher reminder (`run
  /review-changes on staged work before committing`). The compact hook did **not** fire —
  correct, since its matcher is `compact` and this was a `startup` event. The handoff, not
  the hook, was the recovery mechanism this time, as the exercise intended.
- `git status` at start matched the handoff's description exactly: the two test files
  staged, `dates.ts` staged, `position.ts` staged with a 7-line unstaged hunk,
  `CLAUDE.md` / `HARNESS.md` / `.claude/settings.json` modified but unstaged,
  `task-checklist.md` and this file untracked.

### What it did first
1. `cd frontend && npx vitest run` → `Test Files 7 passed (7)`, `Tests 166 passed (166)`,
   1.14 s. Matched the handoff's expectation, so step 1 passed without a report.
2. Read this file to find the Part 2 heading, and diffed `CLAUDE.md` to confirm the
   unstaged change was only the test count (99 → 166) and the domain-test convention
   bullet, since step 3 commits it from the working tree via pathspec.
3. Then steps 2–4 as written.

### Questions it needed to ask
None. Every decision point had an answer in the handoff:
- Whether to fix code on a failure → D1 (no).
- Which files go in which commit and the exact pathspec form → steps 3 and 4, and the
  user's addendum confirmed the two-commit split.
- Whether to re-run `/review-changes` despite the startup reminder → the handoff records
  `REVIEW: CLEAN` on the same staged diff, and `git diff --cached --name-status` showed
  the index unchanged since, so the review was not repeated. The only addition to the
  first commit beyond the reviewed diff is the 6-line `CLAUDE.md` docs change.

### Minor gaps (did not block, worth noting for the next handoff)
- **Step 4 needed a pathspec too.** It read `git add <four files>` then commit. Because
  `dates.ts` and `position.ts` were already in the index, a plain `git commit` swept them
  into the docs commit. Caught from the commit's `--stat`, fixed with `git reset --soft
  HEAD~1` and a re-commit limited to the four paths (nothing had been pushed). Step 3 had
  the pathspec; step 4 should have carried the same form.
- The Co-Authored-By trailer text differs by model version between sessions (the previous
  commit says `Claude Fable 5`; this session's is `Claude Fable 5.1`). The handoff said
  "the session's trailer", which was the right instruction — just be aware the two commits
  from this exercise will carry different trailers.
- The handoff pointed at evidence outside the repo (workflow journals under
  `~/.claude/projects/...`) while the repo's own CLAUDE.md forbids reading outside
  `/Users/chewan/Desktop/TODO`. It was not needed, so the conflict never had to be
  resolved; a future handoff should either omit those pointers or say explicitly that they
  are for the human, not for Claude.
