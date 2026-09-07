# Harness gap log — 2026-09-07 (capstone Slide 13 audit)

Component names per the Slide 13 handout — definitions live there, not here (two copies
of one taxonomy drift apart). This log maps artifacts and records the audit verdicts.

| # | Component | Artifact(s) | Status | Verdict |
|---|-----------|-------------|--------|---------|
| 1 | CLAUDE.md | `CLAUDE.md` (+ auto-memory carrying only per-machine cohort context) | strong | keep — sole carrier of build-time-unenforceable invariants (port 3307, Boot/Gradle pins, five-layer rule, `todo-app-items`); every verifiable claim in it re-checked true during this audit |
| 2 | Permissions | — | **empty** | deliberate — no prompt-fatigue evidence yet; a `legacy/` deny rule would double-enforce the PreToolUse guard from a second surface with a second error message. Revisit with `/fewer-permission-prompts` when prompting actually hurts |
| 3 | Hooks | `settings.json` (SessionStart nudge; PreToolUse `legacy/` guard — **moved here today**), `settings.local.json` (PostToolUse write log) | strong | guard was misfiled in the gitignored local file — every clone had CLAUDE.md's promise with no mechanism; moved, and rewritten to anchor on the project root: blocks `/legacy/` paths inside the repo (incl. `..` traversals), fails closed when the root is unset or jq is missing, and no longer refuses `/tmp/legacy/*`, which Restrictions explicitly allow |
| 4 | Skills | `skills/review-changes`, `skills/contract-check` | strong | both pass would-I-notice: the reviewer agent has no Bash, so review-changes' `git diff --cached` injection is its only feed of a staged diff; contract-check is the only whole-chain check both test suites are structurally blind to (frontend validates against MSW mirrors of its own types; backend validates against itself) |
| 5 | Custom agents | `agents/reviewer.md` | strong | read-only by tool set, not by promise (Read/Grep/Glob, haiku, maxTurns 15); track record: 2 real findings on the staged domain modules (extension-stack-2026-09.md) |
| 6 | MCP servers | `.mcp.json` (playwright) | strong | credential-free, `--isolated` load-bearing (the app's datastore IS localStorage); `@latest` → pinned `0.0.80` today to match the repo's pin-everything discipline |
| 7 | Output styles | `output-styles/mentor.md` | thin | opt-in, zero cost dormant; honest status: never yet activated. Kept for the repo's real user (Spring dev learning React) |

**Imbalance:** hooks/skills/agents heavy, permissions/output-styles light. Defensible, not
accidental: this repo's risks are write-shaped (`legacy/` destruction, silent five-layer
drift), not permission-shaped — the weight sits where the damage is.

## Incoherences found → fixed today

1. **Gitignored-but-claimed-shared**: CLAUDE.md and `hook-refusal-2026-09.txt` present the
   `legacy/` guard as repo-enforced, but it lived in `.claude/settings.local.json`, which
   `.gitignore:3` excludes → moved to committed `settings.json`; CLAUDE.md pointers updated.
2. CLAUDE.md called `todo-app-items` "hook-enforced" — no hook can guard a browser
   localStorage key → reworded (real enforcement: the instruction + reviewer checklist §2).
3. Guard match `test("/legacy/")` was unanchored → rewritten to require the path be inside
   the project root, failing closed (block + honest error) on unset root or missing jq.
4. `.mcp.json` used `@playwright/mcp@latest` in a pin-everything repo → pinned `0.0.80`.
5. CLAUDE.md's tooling section omitted the two checked-in surfaces a fresh session can't
   discover from prose (playwright MCP + approval gate; `mentor` output style) → added.

## Known residuals (acknowledged, not fixed)

- Bash-mediated writes (`sed -i`, `>` redirects) bypass the Write|Edit guard — and would
  equally bypass a permissions deny rule; CLAUDE.md's instruction is the only cover there.
  A Bash-matcher hook would have to parse arbitrary shell: wrong altitude, not attempted.
- `reviewer.md` waives "no raw hex" for `#fff` on accent-filled elements; SPEC.md states
  the rule absolutely while shipped code follows the reviewer. Needs a one-line SPEC
  amendment — owner decision, out of scope for a harness exercise.
- The PostToolUse write log has no consumer and grows unbounded — accepted as course-era
  instrumentation (it supplied this audit's write-burst evidence); sunset after grading.
- A CLAUDE.md higher in the home directory also loads into sessions here; it is unrelated
  to this project and cannot be excluded from inside the repo. Awareness item only.
