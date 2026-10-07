# Workflow Pattern Choices (September 2026)

Patterns, lightest → heaviest (by who drives):
**Direct prompt** (you drive, one shot) → **RPI** (Research → Plan → Implement, fresh
context per phase, written artifacts as handoffs) → **RPIR** (RPI + explicit Review
phase) → **QRSPI** (Question/qualify the goal → Research → Spec → Plan → Implement)
→ **Ralph** (autonomous loop: same prompt re-run until done) → **Multi-agent
harness** (planner → generator → evaluator agents).

Axes: **brownfield vs greenfield**, **stakes**, **ambiguity**.

## The six placements

| # | Task | Pattern | One-sentence justification |
|---|------|---------|---------------------------|
| 1 | Rename a variable across a single file | **Direct prompt — no pattern** | Brownfield but trivially scoped, zero ambiguity, and the compiler/tests verify it for free — any phase structure is pure overhead. |
| 2 | Add a feature touching six files in a service I've never seen | **RPI** | Unfamiliar brownfield makes Research the phase that earns its keep, but stakes are ordinary and the spec is clear, so a formal Review tier isn't warranted beyond normal tests. |
| 3 | Change payment-rounding logic where a wrong result costs money | **RPIR** | Low ambiguity and small diff, but high stakes demand an independent Review phase (adversarial check + property tests on rounding edge cases) that plain RPI doesn't guarantee. |
| 4 | "Make onboarding feel faster" — no clear spec | **QRSPI** | Ambiguity is the dominant axis: the Question and Spec phases exist precisely to turn "feel faster" into a measurable target before any plan is worth writing. |
| 5 | Build a brand-new CLI tool from a one-paragraph spec | **Ralph** | Greenfield with a clear-enough spec and cheap failures is the autonomous loop's home turf: no legacy code to respect, so let it build-test-fix until the spec passes. |
| 6 | *(my real task)* Rebuild my TODO app to production grade: React frontend, Spring Boot backend, MySQL-compatible data model | **Multi-agent harness (planner → generator → evaluator)** | Too large for one context and spans design + two independent codebases, so a design panel (planner), parallel frontend/backend builders (generators), and an independent verify round (evaluators) beat any single-driver pattern. |

## Evaluate — the three axes per task

| # | Brownfield/Greenfield | Stakes | Ambiguity |
|---|---|---|---|
| 1 | Brownfield (one file) | Low (compiler catches) | None |
| 2 | Brownfield, **unfamiliar** | Medium | Low (feature is specced) |
| 3 | Brownfield, familiar | **High (money)** | Low |
| 4 | Brownfield | Medium | **High (no spec)** |
| 5 | **Greenfield** | Low | Low-medium |
| 6 | Greenfield rebuild of a brownfield app (must migrate real user data) | Medium (portfolio + data migration) | Medium (resolved by a design phase) |

**Where two patterns both fit:** Task 2 could be RPIR; stakes tip the call — a
normal feature doesn't justify a dedicated review phase, so RPI + ordinary tests.
Task 5 could be a direct prompt; size tips it — a whole tool needs iteration a
single shot won't survive, and low stakes make autonomy safe.

**Which need no pattern, and how I know:** Task 1 — both stakes and ambiguity are
at floor *and* verification is free (compile + grep). When the cost of being wrong
is lower than the cost of ceremony, prompt directly.

## Reflect — hardest to place

Task 5. "Brand-new tool" pulled heavy (lots of code) while "one-paragraph spec"
pulled light (just prompt it?). Naming the axes resolved it rather than exposing a
judgment call: greenfield removes the research need, low stakes remove the review
need, and a clear spec means the agent can drive — which is exactly the Ralph cell
of the grid. The residual judgment is only spec quality: if the paragraph were
vaguer, it becomes QRSPI, not a heavier harness.

## Verify — one tier up and down for Task 3 (payment rounding)

- **One tier heavier (multi-agent harness):** coordination overhead swamps a
  ~10-line change; parallel agents add nothing an adversarial reviewer doesn't,
  and diffused ownership makes it *less* likely one mind holds every rounding edge
  case (negative amounts, half-cent, currency minor units).
- **One tier lighter (RPI, no Review):** the implementation will look correct and
  pass happy-path tests while silently choosing the wrong rounding rule (half-up
  vs banker's) — exactly the failure class only an independent review with
  property-based cases catches, and it costs real money in production.

Both answers are specific → placement is a judgment, not a guess. And task 1 comes
out "just prompt directly," so the escalation ladder is being climbed deliberately,
not by reflex.
