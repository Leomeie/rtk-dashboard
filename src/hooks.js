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

  // RTK hook
  if (!hooks.some((h) => h.command === "rtk" && h.type === "PreToolUse")) {
    hooks.push({
      type: "PreToolUse",
      command: "rtk",
      script: RTK_HOOK,
    });
    changed = true;
  }

  // OpenWolf hook
  if (!hooks.some((h) => h.command === "openwolf" && h.type === "PreToolUse")) {
    hooks.push({
      type: "PreToolUse",
      command: "openwolf",
      script: OPENWOLF_HOOK,
    });
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
    hooks.push({
      type: "pre_tool_use",
      command: "rtk",
      script: RTK_HOOK,
    });
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
    hooks.push({
      type: "pre_tool_use",
      command: "rtk",
      script: RTK_HOOK,
    });
    changed = true;
  }

  if (changed) writeJson(hookFile, config);
  return changed;
}

module.exports = { installClaudeHooks, installCodexHooks, installOpenCodeHooks };
