#!/usr/bin/env node

/**
 * PostToolUse hook for Claude Code / Codex / OpenCode.
 * Reads token usage from stdin and appends to token-log.jsonl.
 *
 * stdin JSON fields used:
 *   - tool_name, session_id, cwd
 *   - token_usage: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }
 *   - context_window: { current_usage: { input_tokens }, context_window_size }
 *   - model: { id, display_name }
 *   - rate_limits
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function dataDir() {
  const dir = path.join(os.homedir(), ".rtk-dashboard");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function parseStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", reject);
    // Timeout in case stdin is empty
    setTimeout(() => resolve({}), 2000);
  });
}

function extractTokenData(input) {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);

  // Extract token usage from various possible field locations
  const tu = input.token_usage || {};
  const cw = input.context_window || {};
  const cwUsage = cw.current_usage || {};
  const model = input.model || {};

  const inputTokens = tu.input_tokens || cwUsage.input_tokens || 0;
  const outputTokens = tu.output_tokens || 0;
  const cacheRead = tu.cache_read_input_tokens || 0;
  const cacheWrite = tu.cache_creation_input_tokens || 0;

  return {
    timestamp: now,
    date,
    session_id: input.session_id || "unknown",
    cwd: input.cwd || process.cwd(),
    tool_name: input.tool_name || "unknown",
    model_id: model.id || "unknown",
    model_name: model.display_name || model.id || "unknown",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    context_window_size: cw.context_window_size || 0,
    rate_limit_5h: (input.rate_limits?.five_hour?.used_percentage) || 0,
    rate_limit_7d: (input.rate_limits?.seven_day?.used_percentage) || 0,
  };
}

async function main() {
  const input = await parseStdin();

  // Only log if there's meaningful token data
  const data = extractTokenData(input);
  if (data.input_tokens === 0 && data.output_tokens === 0) {
    process.exit(0);
  }

  const logFile = path.join(dataDir(), "token-log.jsonl");
  try {
    fs.appendFileSync(logFile, JSON.stringify(data) + "\n", "utf-8");
  } catch {
    // Silently fail — don't block the tool use
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
