# Context curation — full vs. curated, measured (2026-09-07)

Exercise: **Curate the Context** (lesson: Context Engineering at Depth).
One line on why this matters: context is finite and read non-uniformly, so *what you load* is
a quality lever, not only a cost lever — a smaller, better-arranged set can beat the full
history at a fraction of the tokens.

---

## 1. The session, and the task inside it

The real session: the **harness audit** of this repo (2026-09-07, deliverables `HARNESS.md` +
`harness-gap-log-2026-09.md`). It loaded, in one window: two auto-loaded `CLAUDE.md` files
(the project's 142-line one and the home-directory résumé playbook, ~200 lines), all six
`.claude/` artifacts, `.mcp.json`, `.gitignore`, three dated evidence docs, the output of a
10-agent audit workflow, journal extracts, tool output, and a staged diff.

The decision that mattered: **does this repo's harness actually stop an agent from writing
under `legacy/` on a teammate's clone?** The audit's answer was no — the guard sat in
gitignored `.claude/settings.local.json` while `CLAUDE.md` advertised it as repo policy.

### The 3–5 pieces that actually drove the answer

| # | Piece | Why it was load-bearing |
|---|-------|------------------------|
| 1 | `.gitignore` line 3 — `.claude/settings.local.json` | **The decisive line.** Excludes the file that holds the guard. |
| 2 | `.claude/settings.local.json` (PreToolUse block) | Shows the guard exists, and that it lives *only* here. |
| 3 | `CLAUDE.md:16–18` | The claim under audit ("a PreToolUse hook … refuses any Write/Edit under `legacy/`"). |
| 4 | `.claude/settings.json` | The committed hook surface — held only a SessionStart echo, so it's the fix target. |

Everything else in that window — the résumé playbook, `mentor.md`, both SKILL files,
`reviewer.md`, `mcp-notes`, the staged frontend diff, ~37k tokens of audit output — was
irrelevant to *this* question. The answer is a **two-line join** across pieces 1 and 2.

---

## 2. Experiment design

Three conditions, same question, run in fresh headless sessions with **no tools and no
ambient `CLAUDE.md`** (`cwd=/tmp/ctx-exp`, `--restricted`, all file/search/agent tools
denied, MCP off, `--model opus`). Tool denial is the point: if a run could re-read the repo,
the experiment would measure file access, not context recall. 3 trials per condition.

| Condition | Contents | Bundle |
|---|---|---|
| **A — full** | faithful reconstruction of the session's window, in load order | 92,666 B |
| **B — curated** | the 4 pieces above, nothing else | 4,094 B |
| **C — over-curated** | B minus piece 1 (`.gitignore`), to find the breaking point | 3,802 B |

The fixture is the **pre-fix** repo state (derived from commit `21cdf71` by reversing my
three `CLAUDE.md` edits, removing the guard I added to `settings.json`, and restoring the
`@latest` MCP pin), so the question has the ground truth the audit actually faced.

**Placement.** In B, layout is deliberate: the question sits at both edges (lines 1–20 and
100–118) and the two decisive sources sit at the two edges of the source block —
`.gitignore` first (30% depth), `settings.local.json` last (69–70%). In A, sources appear in
real load order; I measured rather than manipulated depth: guard location 3%, `.gitignore`
exclusion 22%, guard command 36%, and the audit's own restatement of the finding at 66%.

**Deck stacked against the hypothesis.** Bundle A *contains the finished answer* — three
audit agents state the misfiling outright at 66% depth. B contains no stated answer at all,
only primary sources to derive from. So A is a retrieval task; B is a derivation task.

### The check (stated before running)

Q1 scores 4 binary points: (1) verdict `no`; (2) mechanism names `settings.local.json` as
the guard's only home **and** git-exclusion as what decides a clone's fate; (3) evidence
quotes the deciding repo line (the `.gitignore` entry); (4) fix = `.claude/settings.json`.
Q2 is a second probe — "is the `todo-app-items` rule hook-enforced?" — whose material I
deliberately left out of B, to see whether curation induces fabrication. Correct = `no`
(no hook can see a browser localStorage key) or an honest `INSUFFICIENT CONTEXT`;
a confident `yes` is a fabrication and scores zero.

---

## 3. Results

| Condition | Q1 score | Q2 | Input tok | Marginal ctx tok | Out tok | Latency | Steady cost |
|---|---|---|---|---|---|---|---|
| **A — full** | **12/12** | 3/3 | 43,470 | ~36,700 | 250 | 6,553 ms | $0.0556 |
| **B — curated** | **12/12** | 3/3 | 8,387 | ~1,620 | 582 | 9,718 ms | $0.0214 |
| **C — over-curated** | 6/12 (labeled) · 8/12 (neutral) | 5/6 | 8,250 | ~1,480 | 1,022 | 14,795 ms | $0.0360 |

Means of 3 trials. "Marginal ctx" = bundle tokens above the session baseline (system prompt
+ tool defs), estimated at ~6,765 tokens by solving two points for a linear
bytes→tokens rate (0.3961 tok/byte); exact by construction on two points, so treat the
baseline as an estimate — the 22.6× ratio is just the bundle byte ratio and needs no fit.
Cost excludes trial 1 of A ($0.3052, cache creation).

**Curated tied full at 4/4 on every trial, on 22.6× less marginal context and 2.6× the cost
efficiency.** It was *not* faster: 1.48× slower wall-clock, because it wrote 2.3× more output
tokens — it had to derive rather than retrieve. That is the honest cost of curation here, and
it contradicts the usual "smaller is faster" framing.

### Verbatim outputs

**A — full (trial 1):**
```
Q1_VERDICT: no
Q1_MECHANISM: The PreToolUse legacy/ guard lives only in `.claude/settings.local.json`, and `.gitignore` excludes that file from the repo, so a clone never receives it.
Q1_EVIDENCE: `.claude/settings.local.json`
Q1_FIX: `.claude/settings.json`
Q2_VERDICT: no
Q2_WHY: The only PreToolUse hook matches `.tool_input.file_path` against `/legacy/`, which cannot see code that writes or deletes a localStorage key, so the `todo-app-items` rule is carried by CLAUDE.md prose and the reviewer agent's checklist alone.
```
Trials 2–3 identical in substance. Trial 2 prefixed a stray line — `QI_VERDICT placeholder
removed.` — violating "reply in exactly this form and nothing else" (1/3 of full runs; 0/3
curated).

**B — curated (trial 1):**
```
Q1_VERDICT: no
Q1_MECHANISM: The legacy/ PreToolUse guard lives only in `.claude/settings.local.json`, and whether a clone receives that file is decided by `.gitignore`, which excludes it from version control.
Q1_EVIDENCE: `.claude/settings.local.json`
Q1_FIX: `.claude/settings.json`
Q2_VERDICT: no
Q2_WHY: Both settings files are shown in full and their only hooks are a Write/Edit logger and a `file_path`-based `/legacy/` path test — nothing inspects file contents or localStorage keys, so `todo-app-items` is policy text only.
```
Trials 2–3 identical in substance.

**C — over-curated**, first with a header naming the omission (a confound I found and then
fixed), then re-run with a neutral header and no occurrence of the string `gitignore`:
```
[labeled, 3/3]  Q1_VERDICT: INSUFFICIENT CONTEXT — "the deciding line would be the
                `.gitignore` entry covering `.claude/settings.local.json`, which is not
                present in the provided sources."  Q1_FIX still correct.
[neutral, 1/3]  Q1_VERDICT: INSUFFICIENT CONTEXT — "no `.gitignore` line (or any git-tracking
                record) … appears in the three curated sources."
[neutral, 2/3]  Q1_VERDICT: no — but grounded in convention, not evidence: "`settings.local.json`
                is Claude Code's per-machine, untracked local override file (no .gitignore is
                shown in the context, but this is the file's designated role)", and
                Q1_EVIDENCE quoted CLAUDE.md's *claim* instead of the deciding line.
```

---

Raw artifacts: `context-curation-2026-09/` — all 12 answers verbatim (`answer-<cond>-<n>.txt`),
`telemetry.jsonl`, the curated and 3-source bundles, and the build/run scripts. `build.sh`
records how the fixture was assembled; it is a log, not a portable script (it reads this
machine's session-transcript paths). The 92 KB full bundle is regenerable, not committed.

## 4. Evaluation

**Which run answered better?** A tie on the stated check — 12/12 both. Curated wins on
everything else measurable: 22.6× less marginal context, 2.6× cheaper, and 0/3 vs 1/3
output-contract violations. Full wins on latency (1.48×).

**What did the full history actually add, beyond cost and latency?** Exactly one true extra
detail, in all three trials: it named `.claude/agents/reviewer.md`'s checklist as the
*secondary* carrier of the `todo-app-items` rule. Curated said "documentation-only" — correct
but less specific, because `reviewer.md` wasn't in its four sources. So the full window bought
one real increment of completeness for ~35,000 extra tokens. Nothing else: no better verdict,
no better evidence, no better fix.

**A prediction I got wrong.** I expected B to answer `INSUFFICIENT CONTEXT` on Q2 and
possibly fabricate. It did neither — it *proved* the negative from the two complete settings
files ("nothing inspects file contents or localStorage keys"). Completeness of the *right*
files beat volume: showing two files whole was worth more than showing fourteen partially.

**Failure mode.** This task is **retrieval-bound, not volume-bound**: the answer is a
two-line join between one low-salience line in `.gitignore` and one block in
`settings.local.json`, and the risk is dilution of a precise identifier, not depth of
reasoning. Condition C locates the real fragility — and it is not volume. Dropping the
decisive line never produced a fabricated PASS (0/6), but it degraded the answer from
*evidence-grounded* to *convention-inferred* and made the verdict unstable (1/3 abstained,
2/3 inferred). That degradation is the whole ballgame for an audit: a verdict you can't
attach a line number to won't survive review, and two neutral-condition runs quoted
`CLAUDE.md`'s claim as their evidence — mistaking the assertion for the mechanism, which is
precisely the error the audit existed to catch.

**Technique for a version too big for one window.** The scaled task — audit *every*
docs-vs-mechanism claim across this repo (`SPEC.md`, backend, frontend, all docs) — does not
fit one window. I choose **just-in-time retrieval**, because the failure mode is
identifier-precision: the work decomposes into (claim → the 2–4 files that implement it)
lookups, so keeping paths and fetching on demand never loads the diluent in the first place.
Why not the others: **compaction** is actively wrong here — summarizing would drop the
`.gitignore` line, which reads like build noise and is the one thing that must survive
(measured in C). **Agentic memory** is wrong for the *fact* (repo state, invalidated by every
commit — my own fix invalidated it inside one session), though right for the durable *rule*
"check whether the file enforcing a policy is tracked." **Sub-agent isolation** is the
execution wrapper I'd compose with JIT, not a substitute: it decides *where* the window
lives, not *which* items enter it. I have this session's measurement for it — the audit
workflow spent 309,402 subagent tokens and returned ~28 KB (~11k tokens) to my window, ≈27:1
compression at the boundary.

---

## 5. Context-budget sketch — JIT retrieval for a repo-wide claim audit

1. Technique: just-in-time retrieval — one claim per fresh sub-agent window.
2. Resident: the claim ledger — `(claim, doc:line, enforcing-path)`, one line per claim.
3. Fetched per claim: doc excerpt, the enforcing file whole, and `git ls-files <path>` —
   tracked-ness is always a fetch, never a memory.
4. Dropped: sibling artifacts, prose rationale, past narratives, settled claims (verdict kept).
5. Returned upward: `claim | verdict | file:line | one-line fix` — nothing else.
6. Persisted: only the rule "a policy hook must live in a tracked settings file".
7. Breaks if the tracked-ness fetch is dropped: a verdict still appears — convention-
   inferred, citing the doc's own claim as evidence (measured: 1/3 abstained, 2/3 right for
   the wrong reason) — the false PASS this harness exists to stop.
