# Extension Stack — end-to-end run (2026-09-07)

Composition: **agent** (who does the work, least-privileged) + **skill** (when I ask
for it) + **hook** (tied to the session lifecycle) + **output style** (session
register). Each piece does one thing.

## The four artifacts

| Piece | File | Scope it was given |
|---|---|---|
| Agent | `.claude/agents/reviewer.md` | `tools: Read, Grep, Glob` (no write-capable tools), `model: haiku`, `maxTurns: 15`, report-only instructions |
| Skill | `.claude/skills/review-changes/SKILL.md` | Injects `` !`git diff --cached` ``, refuses to review unstaged work, delegates to `reviewer`, relays findings verbatim |
| Hook | `.claude/settings.json` → `SessionStart` | One `echo` reminder to run `/review-changes` before committing |
| Output style | `.claude/output-styles/mentor.md` | Teaching register: Java↔React analogies, `Interview:` flags, one-thing-to-try endings |

Prerequisite created for the demo: `git init` (this repo wasn't under git; no
commits made — staging alone is enough for `git diff --cached`).

## The run (verbatim evidence)

**1. Hook** — validated shape with `jq -e`, then pipe-tested the command:

```
$ echo '{}' | bash -c "<the SessionStart command>"
Taskflow reminder: run /review-changes on staged work before committing.
HOOK PIPE-TEST OK
```

SessionStart fires at session start by definition, so this session (where the hook
was authored mid-flight) can only pipe-test it; it fires for real on the next
`claude` launch in this directory.

**2. Staged a real change** — the two new domain modules:

```
$ git add frontend/src/domain/position.ts frontend/src/domain/dates.ts
$ git diff --cached --stat
 frontend/src/domain/dates.ts    | 112 ++++++++++++++++++++++++++++
 frontend/src/domain/position.ts |  35 +++++++++++
 2 files changed, 147 insertions(+)
```

**3. Invoked the skill:**

```
Skill("review-changes") → error: Unknown skill: review-changes
Agent(subagent_type: "reviewer") → error: Agent type 'reviewer' not found.
```

This is the exercise's own listed failure mode confirmed twice: **skills and agents
register at session start; artifacts added mid-session need a restart to be
invocable.** The files are correct — only registration lags. For the live demo the
skill's playbook was executed manually, delegating to the read-only `Explore` agent
type carrying `reviewer.md`'s instructions verbatim (the closest currently-registered
approximation of a no-write reviewer). Next session, `/review-changes` resolves the
real `reviewer` (haiku, hard tool restriction).

**4. The reviewer's report (unedited):** it verified date handling PASS (no
string-parsed dates anywhere in `frontend/src`, string-based overdue compare) and
position math PASS (matches SPEC exactly, contract parity with
`TaskService.java:194-197` confirmed), then reported:

> **major** — `frontend/src/domain/dates.ts:1-112` — a new 112-line module with 10
> exported functions ships with zero tests ("tests move with behavior");
> `isDateString` gates validation AND the legacy import path, `dueLabel` has six
> untested branches plus leap-year logic. Fix: add `frontend/src/test/dates.test.ts`.
>
> **minor** — `frontend/src/domain/position.ts:17-22` — `midpoint()` can return an
> out-of-contract position (`midpoint(null,1)` → 0; `midpoint(1024,1025)` → 1024);
> safe today only because the sole caller checks `needsRenormalize()` first, but
> that precondition is stated nowhere. Fix: document the precondition or return
> `null` when no usable gap exists.
>
> REVIEW: 2 FINDING(S)

Nothing was edited by the reviewer — read-only held. Both findings are real and
were handed to the fix pipeline.

## Evaluate

**Was a skill the right surface for review behavior?** Yes. In an **output style**
the review posture would color every answer all session (explanations, builds,
docs) — pure noise 95% of the time. In **CLAUDE.md** it would be a standing
instruction Claude weighs on every turn but that guarantees nothing at the moment
of committing — and it bloats every prompt. The skill is a playbook that runs
exactly when invoked, carries the diff-injection mechanics (`!`command``), and pairs
with the hook for the "when": lifecycle nudge from the hook, on-demand execution
from the skill, isolated least-privilege execution from the agent.

**Side effects I'd never let Claude trigger alone:** this repo has none packaged as
skills yet. When one arrives (a `release` skill running `git push`, a `db-migrate`
skill), it gets `disable-model-invocation: true` in its frontmatter so only a typed
`/release` can fire it — the model can never invoke it as a tool. Today the
equivalent control is the PreToolUse guard on `legacy/` (harness-enforced) and git
commits staying user-initiated.

**Least privilege audit:** reviewer = Read/Grep/Glob only, haiku (classification
and checklist work — no need for a frontier model), 15-turn cap. Skill = no side
effects, one shell injection (`git diff --cached`), refuses unstaged review. Hook =
a single `echo`, no state. Output style = register only. Smallest capability set
each needs, and nothing more — the over-permissioning trap this exercise warns
about would be giving the reviewer Edit "so it can fix what it finds," which
silently turns a guard into an actor.

**What to chain next:** a PreToolUse hook on `Write|Edit` matching the five
contract-bearing paths (`domain/types.ts`, `storage/migration.ts`, `dto/`,
`entity/`, `V1__init.sql`) that runs a prompt-type hook asking "does this change
mirror all five layers?" — the mistake most likely to slip through here is silent
contract drift, and that trigger→response pair catches it at the write, not at the
MySQL flip. (`/contract-check` already exists as the on-demand version.)

## Output style note

`mentor.md` was authored (not a built-in). Apply with `/output-style mentor` in a
new session; revert with `/output-style default`. What changes: every frontend
answer leads with the concept, bridges to a Java/Spring analogy (Zustand store ↔
singleton service bean; `useEffect` cleanup ↔ `@PreDestroy`), flags
interview-relevant decisions, ends with one experiment. What you'd lose putting
this in a **skill**: the register wouldn't persist across a session — you'd have to
invoke it per-question. In **CLAUDE.md**: it would apply always, including in
sessions where teaching register is wrong (quick fixes, reviews), and instructions
compete with task instructions instead of replacing the output register.
