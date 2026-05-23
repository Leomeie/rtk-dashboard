const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { detect, checkRtk, checkOpenWolf, checkPython, checkFlask, checkPip, dataDir, isWin } = require("./platforms");
const { installClaudeHooks, installCodexHooks, installOpenCodeHooks } = require("./hooks");

function log(msg) { console.log(`  \x1b[36m>\x1b[0m ${msg}`); }
function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function warn(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); }
function fail(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 120000, stdio: "pipe", ...opts }).trim();
  } catch {
    return null;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => { server.close(); resolve(true); });
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort(start) {
  for (let p = start; p < start + 100; p++) {
    if (await isPortFree(p)) return p;
  }
  return start;
}

function installRtk() {
  log("Installing RTK...");
  // Try cargo first
  const cargo = run("cargo --version");
  if (cargo) {
    const v = run("cargo install rtk --locked");
    if (v !== null) { ok("RTK installed via cargo"); return true; }
  }
  // Try npm
  const nv = run("npm install -g rtk-cli 2>&1");
  if (nv !== null) { ok("RTK installed via npm"); return true; }
  fail("RTK install failed. Install manually: cargo install rtk");
  return false;
}

function installFlask(pythonCmd) {
  log("Installing Flask...");
  const pip = `${pythonCmd} -m pip`;
  const v = run(`${pip} install flask 2>&1`);
  if (v !== null) { ok("Flask installed"); return true; }
  fail("Flask install failed. Run: pip install flask");
  return false;
}

function installOpenWolfPkg() {
  log("Installing OpenWolf...");
  const v = run("npm install -g openwolf 2>&1");
  if (v !== null) { ok("OpenWolf installed"); return true; }
  fail("OpenWolf install failed. Install manually: npm install -g openwolf");
  return false;
}

function findDashboardDir() {
  // Check if running from npm global install
  const npmGlobal = run("npm root -g");
  if (npmGlobal) {
    const pkgDir = path.join(npmGlobal, "rtk-dashboard");
    if (fs.existsSync(path.join(pkgDir, "rtk_dashboard.py"))) return pkgDir;
  }
  // Check relative to this script
  const here = path.resolve(__dirname, "..");
  if (fs.existsSync(path.join(here, "rtk_dashboard.py"))) return here;
  return null;
}

function startDashboard(dashboardDir, port) {
  log(`Starting dashboard on port ${port}...`);
  const py = isWin() ? "python" : "python3";
  const script = path.join(dashboardDir, "rtk_dashboard.py");

  if (isWin()) {
    execSync(`start /b "${py}" "${script}" --port ${port}`, { stdio: "ignore" });
  } else {
    execSync(`${py} "${script}" --port ${port} &`, { stdio: "ignore", shell: true });
  }
  ok(`Dashboard running at http://localhost:${port}`);
}

async function setup(options = {}) {
  console.log("\n\x1b[1m  RTK Dashboard Setup\x1b[0m\n");

  // 1. Ensure data directory
  dataDir();

  // 2. Detect platforms (with custom paths)
  log("Detecting platforms...");
  const customPaths = {};
  if (options.claudePath) customPaths.claude = options.claudePath;
  if (options.codexPath) customPaths.codex = options.codexPath;

  const platforms = detect(customPaths);
  if (platforms.length) {
    platforms.forEach((p) => ok(`${p.name} ${p.version}`));
  } else {
    warn("No supported platforms found (Claude/Codex/OpenCode)");
    warn("Dashboard will run in standalone mode");
    warn("Install a platform later and re-run: rtk-dashboard setup");
  }

  // 3. Check Python
  const py = checkPython();
  if (!py.installed) {
    fail("Python 3 not found. Install from https://python.org");
    return;
  }
  ok(`Python: ${py.version}`);

  // 4. Check pip
  const pip = checkPip(py.cmd);
  if (!pip.installed) {
    fail("pip not found. Run: python -m ensurepip");
    return;
  }

  // 5. Check/install Flask
  const flask = checkFlask(py.cmd);
  if (!flask.installed) {
    installFlask(py.cmd);
  } else {
    ok(`Flask: ${flask.version}`);
  }

  // 6. Check/install RTK
  const rtk = checkRtk();
  if (!rtk.installed) {
    installRtk();
  } else {
    ok(`RTK: ${rtk.version}`);
  }

  // 7. Check/install OpenWolf
  if (!options.noOpenwolf) {
    const wolf = checkOpenWolf();
    if (wolf.installed) {
      ok(`OpenWolf: ${wolf.version}`);
    } else {
      installOpenWolfPkg();
    }
  } else {
    warn("OpenWolf skipped (--no-openwolf)");
  }

  // 8. Find dashboard directory
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    fail("Dashboard files not found. Reinstall: npm install -g rtk-dashboard");
    return;
  }

  // 9. Install hooks
  const installed = [];
  for (const p of platforms) {
    log(`Configuring ${p.name} hooks...`);
    try {
      let changed = false;
      if (p.name === "claude") changed = installClaudeHooks(p.hookFile);
      else if (p.name === "codex") changed = installCodexHooks(p.hookFile);
      else if (p.name === "opencode") changed = installOpenCodeHooks(p.hookFile);

      if (changed) {
        ok(`${p.name} hooks configured`);
        installed.push(p.name);
      } else {
        ok(`${p.name} hooks already configured`);
      }
    } catch (e) {
      fail(`Failed to configure ${p.name}: ${e.message}`);
    }
  }

  // 10. Find free port
  const port = await findFreePort(options.port || 5678);
  if (port !== (options.port || 5678)) {
    warn(`Port ${options.port || 5678} occupied, using ${port}`);
  }

  // 11. Import historical data
  log("Importing historical token data...");
  try {
    const importScript = path.join(dashboardDir, "src", "import-history.py");
    if (fs.existsSync(importScript)) {
      const result = run(`"${py.cmd || 'python'}" "${importScript}"`, { timeout: 60000 });
      if (result) {
        const match = result.match(/Imported (\d+) entries/);
        if (match) ok(`Imported ${match[1]} historical entries`);
        else ok("Historical data imported");
      }
    }
  } catch {}

  // 12. Start dashboard
  startDashboard(dashboardDir, port);

  // Summary
  console.log("\n\x1b[1m  Summary\x1b[0m");
  console.log(`  Dashboard:  \x1b[36mhttp://localhost:${port}\x1b[0m`);
  if (installed.length) {
    console.log(`  Platforms:  ${installed.join(", ")} (hooks configured)`);
  } else {
    console.log(`  Platforms:  \x1b[33mstandalone mode\x1b[0m (no hooks, dashboard still works)`);
  }
  console.log(`  RTK:        ${rtk.installed || checkRtk().installed ? "installed" : "\x1b[33mnot installed\x1b[0m"}`);
  console.log(`  OpenWolf:   ${options.noOpenwolf ? "skipped" : (checkOpenWolf().installed ? "installed" : "\x1b[33mnot installed (optional)\x1b[0m")}`);
  console.log("\n  Commands:");
  console.log(`    rtk-dashboard start --port ${port}    Start dashboard`);
  console.log("    rtk-dashboard status          Check installation\n");
}

function status() {
  console.log("\n\x1b[1m  RTK Dashboard Status\x1b[0m\n");

  const platforms = detect();
  const rtk = checkRtk();
  const wolf = checkOpenWolf();
  const py = checkPython();
  const flask = checkFlask(py.installed ? py.cmd : undefined);

  console.log(`  Python:     ${py.installed ? "\x1b[32m" + py.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  Flask:      ${flask.installed ? "\x1b[32m" + flask.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  RTK:        ${rtk.installed ? "\x1b[32m" + rtk.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  OpenWolf:   ${wolf.installed ? "\x1b[32m" + wolf.version + "\x1b[0m" : "\x1b[33mnot installed (optional)\x1b[0m"}`);

  // Token log status
  const logFile = path.join(dataDir(), "token-log.jsonl");
  if (fs.existsSync(logFile)) {
    const size = fs.statSync(logFile).size;
    const lines = fs.readFileSync(logFile, "utf-8").split("\n").filter(Boolean).length;
    console.log(`  Token Log:  \x1b[32m${lines} entries\x1b[0m (${(size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`  Token Log:  \x1b[33mno data yet\x1b[0m`);
  }

  if (platforms.length) {
    console.log("\n  Platforms:");
    for (const p of platforms) {
      const configExists = fs.existsSync(p.hookFile);
      console.log(`    \x1b[32m${p.name}\x1b[0m ${p.version} ${configExists ? "(config found)" : "(no config)"}`);
    }
  } else {
    console.log("\n  \x1b[33mNo supported platforms detected — standalone mode\x1b[0m");
  }
  console.log();
}

function start(options = {}) {
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    fail("Dashboard files not found. Run: rtk-dashboard setup");
    process.exit(1);
  }
  startDashboard(dashboardDir, options.port || 5678);
}

module.exports = { setup, status, start };
