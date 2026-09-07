#!/bin/bash
# Runs both conditions N times in fresh, tool-less, CLAUDE.md-free headless sessions.
# cwd is /tmp/ctx-exp so no ancestor CLAUDE.md auto-loads; MCP off; every file tool denied.
cd /tmp/ctx-exp
N=${1:-3}
FLAGS=(-p --model opus --strict-mcp-config --mcp-config '{"mcpServers":{}}' --restricted
  --disallowed-tools "Read Glob Grep Edit Write NotebookEdit WebFetch WebSearch Agent Task TodoWrite Skill"
  --output-format json)
for cond in neutral3; do
  for i in $(seq 1 "$N"); do
    out="run-$cond-$i.json"
    [ -s "$out" ] && { echo "skip $out (exists)"; continue; }
    claude "${FLAGS[@]}" < "bundle-$cond.txt" > "$out" 2>"run-$cond-$i.err"
    printf '%s done: in=%s out=%s ms=%s cost=%s\n' "$out" \
      "$(jq -r '.usage.input_tokens + (.usage.cache_read_input_tokens // 0) + (.usage.cache_creation_input_tokens // 0)' "$out" 2>/dev/null)" \
      "$(jq -r '.usage.output_tokens' "$out" 2>/dev/null)" \
      "$(jq -r '.duration_ms' "$out" 2>/dev/null)" \
      "$(jq -r '.total_cost_usd' "$out" 2>/dev/null)"
  done
done
