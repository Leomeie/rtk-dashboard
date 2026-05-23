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

function configDir(platform) {
  const home = os.homedir();
  if (platform === "claude") {
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude");
    }
    return path.join(home, ".claude");
  }
  if (platform === "codex") {
    if (process.platform === "win32") {
      return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Codex");
    }
    return path.join(home, ".codex");
  }
  if (platform === "opencode") {
    return path.join(home, ".opencode");
  }
  return null;
}

function detect() {
  const found = [];

  // Claude Code
  const claudeBin = run("claude --version");
  if (claudeBin) {
    found.push({
      name: "claude",
      version: claudeBin,
      configDir: configDir("claude"),
      hookFile: path.join(configDir("claude"), "settings.json"),
    });
  }

  // Codex
  const codexBin = run("codex --version");
  if (codexBin) {
    found.push({
      name: "codex",
      version: codexBin,
      configDir: configDir("codex"),
      hookFile: path.join(configDir("codex"), "config.json"),
    });
  }

  // OpenCode
  const opencodeBin = run("opencode --version");
  if (opencodeBin) {
    found.push({
      name: "opencode",
      version: opencodeBin,
      configDir: configDir("opencode"),
      hookFile: path.join(configDir("opencode"), "config.json"),
    });
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
  for (const cmd of ["python3 --version", "python --version"]) {
    const v = run(cmd);
    if (v && v.includes("Python 3")) return { installed: true, version: v };
  }
  return { installed: false };
}

function checkFlask() {
  const v = run("python3 -c \"import flask; print(flask.__version__)\"") ||
            run("python -c \"import flask; print(flask.__version__)\"");
  return v ? { installed: true, version: v } : { installed: false };
}

module.exports = { detect, checkRtk, checkOpenWolf, checkPython, checkFlask, configDir };
