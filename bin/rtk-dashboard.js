#!/usr/bin/env node

const { setup, status, start } = require("../src/setup");

// Parse CLI arguments
const args = process.argv.slice(2);
const cmd = args[0] || "help";

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function hasFlag(name) {
  return args.includes(name);
}

const options = {
  claudePath: getArg("--claude-path"),
  codexPath: getArg("--codex-path"),
  port: parseInt(getArg("--port") || "5678", 10),
  noOpenwolf: hasFlag("--no-openwolf"),
};

const HELP = `
  rtk-dashboard - RTK + OpenWolf token savings dashboard

  Usage:
    rtk-dashboard setup [options]     One-click install & configure
    rtk-dashboard start [options]     Start the dashboard
    rtk-dashboard status              Check installation status
    rtk-dashboard help                Show this message

  Options:
    --claude-path <path>   Custom Claude Code binary path
    --codex-path <path>    Custom Codex binary path
    --port <port>          Dashboard port (default: 5678)
    --no-openwolf          Skip OpenWolf installation
`;

switch (cmd) {
  case "setup":
    setup(options).catch((e) => {
      console.error("Setup failed:", e.message);
      process.exit(1);
    });
    break;
  case "start":
    start(options);
    break;
  case "status":
    status();
    break;
  case "help":
  case "--help":
  case "-h":
  default:
    console.log(HELP);
    break;
}
