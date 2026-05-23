const fs = require("node:fs");
const path = require("node:path");

const RTK_HOOK = `const { execSync } = require("child_process");
try {
  const r = execSync("rtk proxy " + process.argv.slice(2).map(a => '"' + a + '"').join(" "), {
    stdio: "inherit", timeout: 30000
  });
  process.exit(r.status || 0);
} catch (e) {
  process.exit(e.status || 1);
}`;

const OPENWOLF_HOOK = `const fs = require("fs");
const path = require("path");
const wolfDir = path.join(process.cwd(), ".wolf");
if (fs.existsSync(wolfDir)) {
  try { require("openwolf").intercept(process.argv); } catch {}
}`;

// Token tracker hook — reads stdin and logs token data
const TOKEN_TRACKER_HOOK = `const fs = require("fs");
const path = require("path");
const os = require("os");

function dataDir() {
  const dir = path.join(os.homedir(), ".rtk-dashboard");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let data = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const tu = input.token_usage || {};
    const cw = input.context_window || {};
    const cwUsage = cw.current_usage || {};
    const model = input.model || {};
    const inputTokens = tu.input_tokens || cwUsage.input_tokens || 0;
    const outputTokens = tu.output_tokens || 0;
    const cacheRead = tu.cache_read_input_tokens || 0;
    const cacheWrite = tu.cache_creation_input_tokens || 0;
    if (inputTokens === 0 && outputTokens === 0) process.exit(0);
    const now = new Date().toISOString();
    const entry = {
      timestamp: now,
      date: now.slice(0, 10),
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
    };
    fs.appendFileSync(path.join(dataDir(), "token-log.jsonl"), JSON.stringify(entry) + "\\n", "utf-8");
  } catch {}
  process.exit(0);
});
setTimeout(() => process.exit(0), 2000);`;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function ensureArray(obj, key) {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key];
}

function installClaudeHooks(hookFile) {
  const config = readJson(hookFile);
  const hooks = ensureArray(config, "hooks");
  let changed = false;

  // RTK hook (PreToolUse)
  if (!hooks.some((h) => h.command === "rtk" && h.type === "PreToolUse")) {
    hooks.push({ type: "PreToolUse", command: "rtk", script: RTK_HOOK });
    changed = true;
  }

  // OpenWolf hook (PreToolUse)
  if (!hooks.some((h) => h.command === "openwolf" && h.type === "PreToolUse")) {
    hooks.push({ type: "PreToolUse", command: "openwolf", script: OPENWOLF_HOOK });
    changed = true;
  }

  // Token tracker hook (PostToolUse)
  if (!hooks.some((h) => h.command === "token-tracker" && h.type === "PostToolUse")) {
    hooks.push({ type: "PostToolUse", command: "token-tracker", script: TOKEN_TRACKER_HOOK });
    changed = true;
  }

  if (changed) writeJson(hookFile, config);
  return changed;
}

function installCodexHooks(hookFile) {
  const config = readJson(hookFile);
  const hooks = ensureArray(config, "hooks");
  let changed = false;

  if (!hooks.some((h) => h.command === "rtk")) {
    hooks.push({ type: "pre_tool_use", command: "rtk", script: RTK_HOOK });
    changed = true;
  }

  if (!hooks.some((h) => h.command === "token-tracker")) {
    hooks.push({ type: "post_tool_use", command: "token-tracker", script: TOKEN_TRACKER_HOOK });
    changed = true;
  }

  if (changed) writeJson(hookFile, config);
  return changed;
}

function installOpenCodeHooks(hookFile) {
  const config = readJson(hookFile);
  const hooks = ensureArray(config, "hooks");
  let changed = false;

  if (!hooks.some((h) => h.command === "rtk")) {
    hooks.push({ type: "pre_tool_use", command: "rtk", script: RTK_HOOK });
    changed = true;
  }

  if (!hooks.some((h) => h.command === "token-tracker")) {
    hooks.push({ type: "post_tool_use", command: "token-tracker", script: TOKEN_TRACKER_HOOK });
    changed = true;
  }

  if (changed) writeJson(hookFile, config);
  return changed;
}

module.exports = { installClaudeHooks, installCodexHooks, installOpenCodeHooks };
