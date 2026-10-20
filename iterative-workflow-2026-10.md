# Iterative workflow — specs/001-notes-focus-loss (2026-10-19/20)

## Git log (T1 `efc7b19` + `03369a1` precede this series)
```
43446e4 docs: review gate before T2 — initial focus broken in real browsers; add T1b, SC-007, T2 tests 6-8
fadd615 fix(frontend): popover initial focus waits until panel is visible (SPEC NOTES-4, SC-007)
347cc7c test(frontend): force local storage adapter in vitest so tests never hit the real backend
48fd653 test(frontend): pin popover tag input focus and Tab/Shift+Tab wrap (SPEC NOTES-3, NOTES-6)
749ed0d test(frontend): pin Escape close/focus-return and Notes blur-commit (SPEC NOTES-5, NOTES-6)
8533252 fix(frontend): Escape no longer commits the Notes draft twice (SPEC NOTES-5)
b00ca3f test(frontend): pin outside-pointer commit, click-keeps-focus, and store-update-while-typing (SPEC NOTES-5, NOTES-7, US3-6)
7024113 test(frontend): pin QuickAdd tag-picker input keeps focus while typing
```
Suite: 173 baseline → 174 (T1) → **185** passing; `tsc -p tsconfig.app.json --noEmit` clean after every commit.

## Acceptance criteria
| Criterion | Evidence |
|---|---|
| SC-001 Notes typing keeps focus (red→green) | T1 test; mutation (onClose back in focus deps) fails it |
| SC-002 tag input keeps focus + Enter creates tag | `48fd653` |
| SC-003 initial focus, Tab/Shift+Tab wrap, Escape close+commit+focus return | `fadd615`, `48fd653`, `749ed0d` |
| SC-004 baseline tests + new, tsc clean | 185 passed, tsc exit 0 |
| SC-005 persisted notes survive reload | **Automated only**: blur/Escape/outside-pointer commit tests incl. `todo.app.v2` envelope. Manual reload not run — `.env` is API mode, typing notes would write to the real backend |
| SC-006 `#travel` chip | store/adapters asserted in test; not clicked through in browser, same reason |
| SC-007 initial focus in a real browser | Playwright on `npm run dev`: `activeElement` = selected priority radio inside dialog; real keypresses in tag input kept focus |
| US1-3/4, US3-5, NOTES-5 outside pointer-down | `749ed0d`, `b00ca3f` |
| US3-6, NOTES-7 | `b00ca3f` |
| IME composition, multi-tab `storage` event | not testable in jsdom; accepted at the gate |

## Evaluate
- **Verification failed first time:** 4 times. (1) T1b red test — intended. (2) T2a tag test passed once, then failed on every rerun → my test had POSTed `travel` to the real backend because `.env` is `api` mode; fixed in `347cc7c`, tag deleted by the owner. (3) Escape wrote twice — the gate's suspicion, confirmed → T4. (4) T2c/T3 passed first time, so I mutation-checked them instead of trusting green.
- **Larger than planned:** T2 (8 tests) split into three commits; the Escape double-write became T4 instead of widening T2; the env leak became its own commit. All splits were right.
- **Smallest commit:** `347cc7c` (one setup line) — could not be smaller. **Largest:** `b00ca3f` (3 tests, ~50 lines) — fine, but test 7 (three controls in a loop) could have been its own commit.
- **Risk profile:** in one big commit, the env leak would have shipped as "flaky tag test" and kept writing to the dev database, and the Escape double-write would have hidden inside a green suite. Per-task runs exposed the first on the second run of the very first new test.
