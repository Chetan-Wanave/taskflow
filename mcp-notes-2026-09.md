# MCP notes — 2026-09

Exercise: **MCP — Extending Claude** (connected lesson: Harness Engineering).
Server chosen: **Playwright MCP** (`@playwright/mcp`), project scope.

## Why Playwright (not Memory or Filesystem)

- Taskflow's frontend is a browser app whose important states (task CRUD, drag-and-drop,
  theme, filter counts) I could previously only verify by eyeballing the screen myself.
  Browser automation closes Claude's biggest blind spot in this repo.
- Memory MCP would duplicate what Claude Code's built-in auto-memory already does here
  (free-form project notes); I have no "list all people who work at X"-shaped facts.
- Filesystem MCP conflicts with this repo's rule "work only inside `/Users/chewan/Desktop/TODO`".

## Verify: `claude mcp list`

```
Checking MCP server health…

playwright: npx -y @playwright/mcp@latest --browser chrome --headless --isolated --output-dir .playwright-mcp - ✔ Connected
```

## Setup (what it actually took)

1. `claude mcp add --scope project playwright -- npx -y @playwright/mcp@latest --browser chrome --headless --isolated --output-dir .playwright-mcp`
   → writes `.mcp.json` at repo root (the shareable, checked-in config).
2. **Approval gate:** `claude mcp list` first showed `⏸ Pending approval`. Project-scope
   `.mcp.json` servers don't run until approved — a deliberate security gate, since
   `.mcp.json` ships with the repo and could otherwise auto-execute arbitrary commands on
   anyone who clones it. Non-interactive fix: `"enabledMcpjsonServers": ["playwright"]` in
   `.claude/settings.local.json` (per-machine, not committed).
3. `--browser chrome` reuses installed Google Chrome — no Chromium download step.
   `--isolated` keeps each browser session's profile in memory (clean localStorage every run).

**Credentials:** Playwright MCP needs none, so the env-var rule is satisfied trivially —
`.mcp.json` contains an empty `env` block. For a credentialed server the pattern is
expansion from the environment, never a literal in the file:

```json
"env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
```

## The real task (not hello-world)

With the Vite dev server running, a Claude instance used the Playwright tools to:
navigate to `http://localhost:5173` → add a task **"Verify Playwright MCP integration
(2026-09)"** through the actual new-task input → confirm via accessibility snapshot that
it rendered (`button "Verify Playwright MCP integration (2026-09)"`, sidebar counts
All 1 / Active 1) → capture `mcp-playwright-check-2026-09.png`. This exercises the real
Zustand store + `LocalStorageAdapter` through the browser — the same path a user takes,
which unit tests and even the adapter contract suite never touch.

## Evaluate

**What changed in the workflow:** "Does it work?" no longer ends at "tests pass."
Claude can now open the running app, interact with it, and read back both an
accessibility snapshot (structured, assertable) and a pixel screenshot (visual
regression). UI claims become verifiable instead of taken on faith — e.g. the existing
`screenshot-*.png` checks in `frontend/` can now be reproduced on demand instead of
being one-off artifacts.

**New failure modes observed (all real, all hit in this session):**
1. *Approval desync* — server added but `⏸ Pending approval`; everything looks configured
   yet nothing runs until the per-machine approval exists.
2. *Session staleness* — a server added mid-session is invisible to the already-running
   session (tool inventory loads at startup). Worked around by driving the task through a
   headless `claude -p --mcp-config .mcp.json --strict-mcp-config` subprocess; the normal
   fix is restarting the session.
3. *Output-path drift* — `--output-dir .playwright-mcp` governs auto-generated artifacts
   (console logs, page snapshots), but an explicit screenshot `filename` resolved against
   the server's cwd instead, so the PNG landed at repo root while the tool reported a
   relative `./` path. Server and orchestrator can disagree about where files went.
4. *External dependency* — the tools silently depend on the dev server being up; a down
   Vite means navigation errors, not a clear "start the app first."

**Was the friction worth it? Keep it for the team?** Yes — setup was ~10 minutes
including the approval detour, and the capability (agent-verifiable UI) is something no
built-in tool provides. I'd keep `.mcp.json` checked in for the team: it's credential-free,
and the approval gate means each teammate consciously opts in on first use. Caveats for
teammates: expect the approval prompt, restart your session after adding, and don't trust
reported file paths — verify where artifacts land.

## Artifacts

- `.mcp.json` — server config (repo root, credential-free)
- `mcp-playwright-check-2026-09.png` — screenshot captured through the MCP server
- `.playwright-mcp/` — server's auto-generated logs/snapshots (gitignore-worthy)

## Bring to cohort

`.mcp.json` above (no credentials to redact — that's a feature of this server choice), the
`claude mcp list` output, and one observation: **the sharpest workflow change wasn't
screenshots — it was the accessibility snapshot.** It returns the UI as structured text
(roles, names, refs), so an agent can *assert* on UI state ("the task button exists,
count says All 1") rather than squint at pixels; the screenshot is just corroboration.
