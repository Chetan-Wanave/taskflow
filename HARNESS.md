# HARNESS.md — why each piece of this repo's Claude Code harness exists

The seven-component taxonomy and the anti-patterns live in the capstone Slide 13 handout —
deliberately not restated here (two copies of one taxonomy drift apart). The full
component→artifact audit is `harness-gap-log-2026-09.md`; six of seven components are
populated, permissions is deliberately empty (see the rejection below).

## Artifacts (tag = what it buys: effectiveness | quality | reliability)

- **`CLAUDE.md`** — *reliability*. Sole every-session carrier of what nothing enforces at
  build time: port 3307, the Boot 3.5.3/Gradle 8.14.2 pins, the five-layer rule, and the
  `todo-app-items` NEVER rule (a localStorage key no hook can reach).
- **`.claude/settings.json` · PreToolUse `legacy/` guard** — *reliability*. The one
  damage-preventing hook: exit-2 blocks the Write before it runs (`hook-refusal-2026-09.txt`
  — the 2026-09-06 capture is of the original command; the relocated, root-anchored rewrite
  is pipe-tested in the same file's addendum). Moved here from gitignored
  `settings.local.json` in this audit — repo policy must travel with a clone.
- **`.claude/settings.json` · SessionStart reminder** — *effectiveness*. Weakest artifact,
  held honestly: one echo pairing the "when" (commit time) with `/review-changes`. It
  steered this very session's commit flow; strip it the day it stops doing that.
- **`.claude/settings.json` · SessionStart `compact` re-injection** — *reliability*. Prints
  `task-checklist.md` into the fresh context after every compaction (matcher `compact`),
  so a long task's steps, decisions, and current status survive the summary. Guarded on
  file existence — silent when no task file is present. Evidence: `session-recovery-2026-09.md`.
- **`.claude/settings.local.json`** — *reliability*. Only genuinely per-machine state: MCP
  approval (`enabledMcpjsonServers`) and the PostToolUse write log (course-era
  instrumentation, sunset after grading — but it supplied this audit's key evidence).
- **`.claude/skills/review-changes`** — *effectiveness*. The reviewer agent has no Bash, so
  this skill's `git diff --cached` injection is its only feed of a staged diff; it refuses
  unstaged review. Track record: 2 real findings on the domain modules (extension-stack).
- **`.claude/skills/contract-check`** — *reliability*. The only whole-chain check on the
  five-layer invariant both test suites are structurally blind to (frontend tests validate
  against MSW mirrors of frontend types; backend validates against itself).
- **`.claude/agents/reviewer.md`** — *reliability*. "Never edits" as a tool-level guarantee
  (Read/Grep/Glob, haiku, maxTurns 15), not a prompt promise.
- **`.claude/output-styles/mentor.md`** — *quality*. Opt-in teaching register for this
  repo's real user (a Spring dev learning React); zero cost while dormant.
- **`.mcp.json` (playwright)** — *effectiveness*. The one capability no built-in tool
  provides: asserting on live UI state via accessibility snapshot. Credential-free;
  `--isolated` is load-bearing (the app's datastore IS localStorage). Pinned to 0.0.80.

## The rejection

Rejected: a PreToolUse hook on the five contract-bearing paths asking "does this change
mirror all five layers?" — my own prior proposal (extension-stack-2026-09.md, "what to
chain next"). The write boundary is the wrong audit point for an *eventually-consistent*
invariant: every correct domain change passes through writes where the layers disagree by
construction, and the tool log records a real burst — three single-layer `dto/` edits in
8 seconds — each of which would have fired the hook on correct work. The steelman (a Stop
hook grepping the write log) dodges per-write noise but fails one level up: turn ≠ change
boundary — multi-turn changes are legitimate, which is exactly why contract-check has its
NOT-BUILT-YET clause — and a six-file cross-language audit is a playbook, not a hook
payload. The selection rule this leaves behind: always-invariant → blocking hook
(`legacy/`); eventually-consistent invariant → change-boundary skill (`/contract-check`);
nudge → SessionStart echo. Corollary kept: permissions stays empty — a `legacy/` deny rule
would double-enforce the hook from a second surface with a second error message.

## Cross-artifact reference (annotated)

SessionStart hook (`settings.json`) names `/review-changes` → `SKILL.md` step 2 delegates
to subagent `reviewer` → `reviewer.md:36` defines the `REVIEW: CLEAN | N FINDING(S)`
sentinel → `SKILL.md` step 3 keys its stop condition on that sentinel. Four artifacts on
three surfaces (hook, skill, agent), coupled by name and by output protocol: the hook is
the *when*, the skill the *how*, the agent the *least-privileged who*. `CLAUDE.md`
documents the pairing, and this file is where the coupling is allowed to be written down.

## Verify (live demo script)

1. `claude mcp list` → `playwright … ✔ Connected`
2. Write any file, then `tail .claude-tool-log.txt` → PostToolUse hook logged it
3. Ask Claude to write under `legacy/` → exit-2 refusal (expected behavior, per CLAUDE.md)
4. Stage a change, run `/review-changes` → reviewer report ends `REVIEW: …`
