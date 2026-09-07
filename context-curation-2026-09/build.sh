#!/bin/bash
# Rebuilds the two context bundles for the curation experiment.
# Reconstructs the harness-audit session's PRE-FIX state (before the guard was moved).
set -e
F=/tmp/ctx-exp/prefix
OUT=/tmp/ctx-exp
WF=/private/tmp/claude-502/-Users-chewan-Desktop-TODO/be5bb462-bb93-42fa-9fc3-4d6c6f91a2a4/tasks/wzgd38cj3.output
JR=/Users/chewan/.claude/projects/-Users-chewan-Desktop-TODO/24665b8a-0162-45be-916a-88ecbfaef973/subagents/workflows/wf_1332dd93-b98/journal.jsonl

# ---------- shared wrapper (identical in both conditions) ----------
wrapper() {
cat <<'EOF'
TASK
You are auditing the Claude Code harness of a repository called "Taskflow". Answer ONLY from
the context contained in this message. You have no filesystem access, no tools, and no access
to the repository itself. If the context does not contain what a question needs, answer
INSUFFICIENT CONTEXT for that question instead of guessing.

Q1. A teammate clones this repository and runs Claude Code inside their clone. Does the
    harness MECHANICALLY stop an agent from writing a file under legacy/ on that clone?
Q2. The repo declares the localStorage key 'todo-app-items' read-only forever. Is that
    particular rule mechanically enforced by a hook?

Reply in exactly this form and nothing else:
Q1_VERDICT: <yes|no|INSUFFICIENT CONTEXT>
Q1_MECHANISM: <one sentence: which file holds the legacy/ guard, and what decides whether a clone receives that file>
Q1_EVIDENCE: <quote the single line of the repo that decides it>
Q1_FIX: <the one file the guard must move to, or "none needed">
Q2_VERDICT: <yes|no|INSUFFICIENT CONTEXT>
Q2_WHY: <one sentence>
EOF
}

sec() { printf '\n\n===== %s =====\n' "$1"; }

# ---------- CONDITION A: full context ----------
{
wrapper
printf '\n\n########## CONTEXT (full session load) ##########\n'

sec "auto-loaded ~/CLAUDE.md (home directory, loads in every session here)"
cat <<'EOF'
# CLAUDE.md — Résumé & Cover Letter Playbook for Chetan Wanave
[~200 lines. Section skeleton reproduced; body omitted from this fixture to keep personal
contact details out of a scratch file. Irrelevant to the Taskflow harness.]
0. How to use this file / 1. Candidate master profile (contact, current role, education,
genuine core stack, real work highlights, projects, certifications, leadership) /
2. Chetan's rules (ATS-friendly, add JD skills, weave keywords, sound human, one page,
export PDF, title, projects separate, base on real experience) / 3. Claude's added rules for
getting selected (mirror JD language, results-first bullets, quantify, tailor summary,
front-load differentiator, match seniority, no keyword stuffing, consistent formatting,
verify one page, keep editable html) / 4. Résumé structure / 5. Tone & anti-AI-detection /
6. HTML template + CSS / 7. Generate the PDF (headless Chrome) / 8. Honesty checks /
9. Cover letter guidance / 10. Job-search strategy notes
EOF

sec "auto-loaded CLAUDE.md (project instructions, /Users/chewan/Desktop/TODO)"
cat "$F/CLAUDE.md"

sec "git status at session start"
cat <<'EOF'
Current branch: HEAD ; Main branch: main ; Git user: chewan
Status:
A  frontend/src/domain/dates.ts
AM frontend/src/domain/position.ts
?? .claude/  ?? .gitignore  ?? .mcp.json  ?? CLAUDE.md  ?? README.md  ?? SPEC.md
?? architecture--2026-09.md  ?? backend/  ?? docker-compose.yml  ?? extension-stack-2026-09.md
?? frontend/ (many paths)  ?? hook-refusal-2026-09.txt  ?? legacy/  ?? mcp-notes-2026-09.md
?? mcp-playwright-check-2026-09.png  ?? plan-production-rebuild-2026-09.md  ?? schema.sql
?? workflow-pattern-choices-2026-09.md
Recent commits: (none — no commits yet on main)
EOF

sec "file listing: .claude/"
cat <<'EOF'
.claude/agents/reviewer.md
.claude/output-styles/mentor.md
.claude/settings.json
.claude/settings.local.json
.claude/skills/contract-check/SKILL.md
.claude/skills/review-changes/SKILL.md
EOF

sec "file: .claude/settings.json"
cat "$F/.claude/settings.json"
sec "file: .claude/settings.local.json"
cat "$F/.claude/settings.local.json"
sec "file: .claude/agents/reviewer.md"
cat "$F/.claude/agents/reviewer.md"
sec "file: .claude/output-styles/mentor.md"
cat "$F/.claude/output-styles/mentor.md"
sec "file: .claude/skills/review-changes/SKILL.md"
cat "$F/.claude/skills/review-changes/SKILL.md"
sec "file: .claude/skills/contract-check/SKILL.md"
cat "$F/.claude/skills/contract-check/SKILL.md"
sec "file: .mcp.json"
cat "$F/.mcp.json"
sec "file: .gitignore"
cat "$F/.gitignore"
sec "file: extension-stack-2026-09.md"
cat "$F/extension-stack-2026-09.md"
sec "file: mcp-notes-2026-09.md"
cat "$F/mcp-notes-2026-09.md"
sec "file: hook-refusal-2026-09.txt"
cat "$F/hook-refusal-2026-09.txt"

sec "shell: claude mcp list"
cat <<'EOF'
Checking MCP server health...
playwright: npx -y @playwright/mcp@latest --browser chrome --headless --isolated --output-dir .playwright-mcp - Connected
EOF

sec "shell: tail -5 .claude-tool-log.txt"
cat <<'EOF'
[2026-09-06T20:01:46Z] Write on /Users/chewan/.claude/projects/-Users-chewan-Desktop-TODO/memory/taskflow-cohort-context.md
[2026-09-06T20:01:48Z] Write on /Users/chewan/.claude/projects/-Users-chewan-Desktop-TODO/memory/MEMORY.md
[2026-09-07T07:54:59Z] Edit on /Users/chewan/Desktop/TODO/.claude/settings.local.json
[2026-09-07T07:58:25Z] Write on /Users/chewan/Desktop/TODO/mcp-notes-2026-09.md
[2026-09-07T07:58:42Z] Edit on /Users/chewan/Desktop/TODO/.gitignore
EOF

sec "workflow result: 10-agent harness audit (as delivered to the window, truncated)"
head -c 28363 "$WF"

sec "workflow journal extracts (per-agent structured results)"
python3 - "$JR" <<'PY'
import json,sys
for line in open(sys.argv[1]):
    try: j=json.loads(line)
    except: continue
    if j.get('type')!='result': continue
    v=j.get('result') or {}
    if not isinstance(v,dict): continue
    if 'artifact' in v:
        print('='*70); print(f"{v['artifact']} | {v['verdict']} | {v['tag']}")
        print('RATIONALE:',v['rationale']); print('NOTICE:',v['wouldNotice'][:500])
        if v.get('changeSuggestion'): print('CHANGE:',v['changeSuggestion'][:350])
        print('XREFS:',' ~~ '.join(v['crossRefs'])[:600])
    elif 'gaps' in v:
        print('='*70); print('GAP REPORT'); print(json.dumps(v,indent=1)[:4000])
    elif 'tradeoffReal' in v:
        print('='*70); print('REJECTION ADVERSARY'); print(json.dumps(v,indent=1)[:4000])
PY

sec "staged diff under review (frontend/src/domain)"
cd /Users/chewan/Desktop/TODO && git diff --cached

printf '\n\n########## END OF CONTEXT ##########\n\n'
wrapper
} > "$OUT/bundle-full.txt"

# ---------- CONDITION B: curated subset ----------
# Layout is deliberate: the two decisive sources sit at the two EDGES (source 1 and
# source 4); supporting material sits between them. Question repeated at both edges.
{
wrapper
printf '\n\n########## CONTEXT (curated: 4 sources) ##########\n'

sec "SOURCE 1 of 4 -- file: .gitignore (complete)"
cat "$F/.gitignore"

sec "SOURCE 2 of 4 -- excerpt: CLAUDE.md lines 14-18 (repo policy statement)"
sed -n '14,18p' "$F/CLAUDE.md"

sec "SOURCE 3 of 4 -- file: .claude/settings.json (complete)"
cat "$F/.claude/settings.json"

sec "SOURCE 4 of 4 -- file: .claude/settings.local.json (complete)"
cat "$F/.claude/settings.local.json"

printf '\n\n########## END OF CONTEXT ##########\n\n'
wrapper
} > "$OUT/bundle-curated.txt"

wc -c "$OUT/bundle-full.txt" "$OUT/bundle-curated.txt"
