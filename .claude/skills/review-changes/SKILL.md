---
name: review-changes
description: Review the currently staged git diff against Taskflow conventions by delegating to the read-only reviewer agent. Use before committing staged work.
argument-hint: [optional focus, e.g. "frontend only" or "contract fields"]
---

## Staged changes

!`git diff --cached --stat`

!`git diff --cached`

## Instructions

1. If the staged diff above is empty, say "Nothing staged — `git add` your changes
   first" and stop. Do not review the working tree instead.
2. Otherwise, delegate the detailed review to the **reviewer** agent (subagent type
   `reviewer` — read-only, haiku). Pass it: the staged diff above, the optional
   focus from `$ARGUMENTS`, and a reminder to check the conventions listed in its
   own instructions (five-layer contract, safety invariants, tokens, dates,
   backend layering, tests-move-with-behavior).
3. Relay the reviewer's findings to the user verbatim, grouped by severity — do not
   soften, re-rank, or drop findings. Do not edit any files; this skill is
   review-only. If the reviewer reports `REVIEW: CLEAN`, say so and stop.
