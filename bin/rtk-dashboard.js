#!/usr/bin/env node

const { setup, status, start } = require("../src/setup");

const cmd = process.argv[2];

const HELP = `
  rtk-dashboard - RTK + OpenWolf token savings dashboard

  Usage:
    rtk-dashboard setup     One-click install & configure everything
    rtk-dashboard start     Start the dashboard
    rtk-dashboard status    Check installation status
    rtk-dashboard help      Show this message
`;

switch (cmd) {
  case "setup":
    setup().catch((e) => {
      console.error("Setup failed:", e.message);
      process.exit(1);
    });
    break;
  case "start":
    start();
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
