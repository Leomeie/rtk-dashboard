const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function isWin() { return process.platform === "win32"; }
function isMac() { return process.platform === "darwin"; }
function isLinux() { return process.platform === "linux"; }

function configDir(platform) {
  const home = os.homedir();
  if (platform === "claude") {
    if (isWin()) return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude");
    return path.join(home, ".claude");
  }
  if (platform === "codex") {
    if (isWin()) return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Codex");
    return path.join(home, ".codex");
  }
  if (platform === "opencode") {
    return path.join(home, ".opencode");
  }
  return null;
}

// Scan common installation paths for a binary
function scanPaths(name, candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findClaudeBinary() {
  // 1. Check PATH
  const inPath = isWin() ? run("where claude 2>nul") : run("which claude 2>/dev/null");
  if (inPath) return inPath.split("\n")[0].trim();

  // 2. Scan common paths
  const home = os.homedir();
  const candidates = [
    // Windows
    path.join(process.env.APPDATA || "", "npm", "claude.cmd"),
    path.join(process.env.LOCALAPPDATA || "", "claude", "claude.exe"),
    // macOS
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
    path.join(home, ".local", "bin", "claude"),
    // Linux
    "/usr/local/bin/claude",
    "/usr/bin/claude",
    path.join(home, ".local", "bin", "claude"),
    path.join(home, ".npm-global", "bin", "claude"),
  ];
  return scanPaths("claude", candidates);
}

function findCodexBinary() {
  const inPath = isWin() ? run("where codex 2>nul") : run("which codex 2>/dev/null");
  if (inPath) return inPath.split("\n")[0].trim();

  const home = os.homedir();
  const candidates = [
    path.join(process.env.APPDATA || "", "npm", "codex.cmd"),
    path.join(process.env.LOCALAPPDATA || "", "codex", "codex.exe"),
    "/usr/local/bin/codex",
    "/opt/homebrew/bin/codex",
    path.join(home, ".local", "bin", "codex"),
    "/usr/local/bin/codex",
    "/usr/bin/codex",
  ];
  return scanPaths("codex", candidates);
}

function detect(customPaths = {}) {
  const found = [];

  // Claude Code
  const claudeBin = customPaths.claude || findClaudeBinary();
  if (claudeBin) {
    const ver = run(`"${claudeBin}" --version`) || run(`${claudeBin} --version`);
    if (ver) {
      found.push({
        name: "claude",
        version: ver,
        binary: claudeBin,
        configDir: configDir("claude"),
        hookFile: path.join(configDir("claude"), "settings.json"),
      });
    }
  }

  // Codex
  const codexBin = customPaths.codex || findCodexBinary();
  if (codexBin) {
    const ver = run(`"${codexBin}" --version`) || run(`${codexBin} --version`);
    if (ver) {
      found.push({
        name: "codex",
        version: ver,
        binary: codexBin,
        configDir: configDir("codex"),
        hookFile: path.join(configDir("codex"), "config.json"),
      });
    }
  }

  // OpenCode
  const opencodeBin = isWin() ? run("where opencode 2>nul") : run("which opencode 2>/dev/null");
  if (opencodeBin) {
    const bin = opencodeBin.split("\n")[0].trim();
    const ver = run(`"${bin}" --version`);
    if (ver) {
      found.push({
        name: "opencode",
        version: ver,
        binary: bin,
        configDir: configDir("opencode"),
        hookFile: path.join(configDir("opencode"), "config.json"),
      });
    }
  }

  return found;
}

function checkRtk() {
  const v = run("rtk --version");
  return v ? { installed: true, version: v } : { installed: false };
}

function checkOpenWolf() {
  const v = run("openwolf --version");
  return v ? { installed: true, version: v } : { installed: false };
}

function checkPython() {
  const cmds = isWin()
    ? ["python --version", "python3 --version"]
    : ["python3 --version", "python --version"];
  for (const cmd of cmds) {
    const v = run(cmd);
    if (v && v.includes("Python 3")) return { installed: true, version: v, cmd: cmd.split(" ")[0] };
  }
  return { installed: false };
}

function checkFlask(pythonCmd) {
  const py = pythonCmd || (isWin() ? "python" : "python3");
  const v = run(`${py} -c "import flask; print(flask.__version__)"`);
  return v ? { installed: true, version: v } : { installed: false };
}

function checkPip(pythonCmd) {
  const py = pythonCmd || (isWin() ? "python" : "python3");
  // Try python -m pip first (most reliable)
  const v = run(`${py} -m pip --version`);
  return v ? { installed: true, version: v } : { installed: false };
}

function dataDir() {
  const dir = path.join(os.homedir(), ".rtk-dashboard");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { detect, checkRtk, checkOpenWolf, checkPython, checkFlask, checkPip, configDir, dataDir, isWin, isMac, isLinux };
