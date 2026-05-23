const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { detect, checkRtk, checkOpenWolf, checkPython, checkFlask } = require("./platforms");
const { installClaudeHooks, installCodexHooks, installOpenCodeHooks } = require("./hooks");

const DASHBOARD_PORT = 5678;

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

function installRtk() {
  log("Installing RTK...");
  const v = run("cargo install rtk --locked");
  if (v !== null) { ok("RTK installed"); return true; }

  // Try npm fallback
  const nv = run("npm install -g rtk-cli 2>&1");
  if (nv !== null) { ok("RTK installed via npm"); return true; }

  fail("RTK install failed. Install manually: cargo install rtk");
  return false;
}

function installFlask() {
  log("Installing Flask...");
  const py = process.platform === "win32" ? "python" : "python3";
  const v = run(`${py} -m pip install flask 2>&1`);
  if (v !== null) { ok("Flask installed"); return true; }
  fail("Flask install failed. Run: pip install flask");
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

function startDashboard(dashboardDir) {
  log("Starting dashboard on port " + DASHBOARD_PORT + "...");
  const py = process.platform === "win32" ? "python" : "python3";
  const cmd = `${py} "${path.join(dashboardDir, "rtk_dashboard.py")}"`;

  if (process.platform === "win32") {
    execSync(`start /b ${py} "${path.join(dashboardDir, "rtk_dashboard.py")}"`, { stdio: "ignore" });
  } else {
    execSync(`${cmd} &`, { stdio: "ignore", shell: true });
  }
  ok(`Dashboard running at http://localhost:${DASHBOARD_PORT}`);
}

async function setup() {
  console.log("\n\x1b[1m  RTK Dashboard Setup\x1b[0m\n");

  // 1. Detect platforms
  log("Detecting platforms...");
  const platforms = detect();
  if (platforms.length) {
    platforms.forEach((p) => ok(`${p.name} ${p.version}`));
  } else {
    warn("No supported platforms found (Claude/Codex/OpenCode)");
  }

  // 2. Check Python
  const py = checkPython();
  if (!py.installed) {
    fail("Python 3 not found. Install from python.org");
    return;
  }
  ok(`Python: ${py.version}`);

  // 3. Check/install Flask
  const flask = checkFlask();
  if (!flask.installed) {
    installFlask();
  } else {
    ok(`Flask: ${flask.version}`);
  }

  // 4. Check/install RTK
  const rtk = checkRtk();
  if (!rtk.installed) {
    installRtk();
  } else {
    ok(`RTK: ${rtk.version}`);
  }

  // 5. Check OpenWolf
  const wolf = checkOpenWolf();
  if (wolf.installed) {
    ok(`OpenWolf: ${wolf.version}`);
  } else {
    warn("OpenWolf not installed (optional). Install: npm install -g openwolf");
  }

  // 6. Find dashboard directory
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    fail("Dashboard files not found. Reinstall: npm install -g rtk-dashboard");
    return;
  }

  // 7. Install hooks
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

  // 8. Start dashboard
  startDashboard(dashboardDir);

  // Summary
  console.log("\n\x1b[1m  Summary\x1b[0m");
  console.log(`  Dashboard:  \x1b[36mhttp://localhost:${DASHBOARD_PORT}\x1b[0m`);
  if (installed.length) console.log(`  Platforms:  ${installed.join(", ")}`);
  console.log(`  RTK:        ${rtk.installed ? "installed" : "NOT INSTALLED"}`);
  console.log(`  OpenWolf:   ${wolf.installed ? "installed" : "optional (not installed)"}`);
  console.log("\n  Commands:");
  console.log("    rtk-dashboard start    Start dashboard");
  console.log("    rtk-dashboard status   Check installation\n");
}

function status() {
  console.log("\n\x1b[1m  RTK Dashboard Status\x1b[0m\n");

  const platforms = detect();
  const rtk = checkRtk();
  const wolf = checkOpenWolf();
  const py = checkPython();
  const flask = checkFlask();

  console.log(`  Python:     ${py.installed ? "\x1b[32m" + py.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  Flask:      ${flask.installed ? "\x1b[32m" + flask.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  RTK:        ${rtk.installed ? "\x1b[32m" + rtk.version + "\x1b[0m" : "\x1b[31mnot installed\x1b[0m"}`);
  console.log(`  OpenWolf:   ${wolf.installed ? "\x1b[32m" + wolf.version + "\x1b[0m" : "\x1b[33mnot installed (optional)\x1b[0m"}`);

  if (platforms.length) {
    console.log("\n  Platforms:");
    for (const p of platforms) {
      const configExists = fs.existsSync(p.hookFile);
      console.log(`    \x1b[32m${p.name}\x1b[0m ${p.version} ${configExists ? "(config found)" : "(no config)"}`);
    }
  } else {
    console.log("\n  \x1b[33mNo supported platforms detected\x1b[0m");
  }
  console.log();
}

function start() {
  const dashboardDir = findDashboardDir();
  if (!dashboardDir) {
    fail("Dashboard files not found. Run: rtk-dashboard setup");
    process.exit(1);
  }
  startDashboard(dashboardDir);
}

module.exports = { setup, status, start };
