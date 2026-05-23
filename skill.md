---
name: rtk-dashboard
description: One-click setup for RTK + OpenWolf token savings dashboard. Installs RTK, OpenWolf, configures hooks for Claude Code/Codex, and launches a real-time web dashboard showing token savings per project.
triggers:
  - "setup rtk"
  - "install rtk dashboard"
  - "configure rtk"
  - "token savings dashboard"
  - "openwolf setup"
---

# RTK Dashboard Skill

Sets up and manages RTK (Rust Token Killer) + OpenWolf token savings dashboard.

## When to use

- User wants to install or configure RTK for token savings
- User wants to set up OpenWolf for persistent AI memory
- User wants to see their token savings in a web dashboard
- User asks about token optimization tools

## Setup command

Run the one-click setup:

```bash
npx rtk-dashboard setup
```

Or if installed globally:

```bash
rtk-dashboard setup
```

This automatically:
1. Detects installed platforms (Claude Code, Codex, OpenCode)
2. Installs Python Flask if missing
3. Installs RTK if missing (`cargo install rtk`)
4. Installs OpenWolf if missing (`npm install -g openwolf`)
5. Configures CLI hooks for detected platforms
6. Starts the web dashboard at http://localhost:5678

## Other commands

```bash
rtk-dashboard start     # Start dashboard
rtk-dashboard status    # Check what's installed
```

## What RTK does

RTK intercepts CLI commands (git, ls, cat, etc.) in Claude Code and compresses the output before sending to Claude, saving 40-90% of tokens per command.

## What OpenWolf does

OpenWolf adds persistent memory to Claude Code projects. It tracks file reads/writes, prevents redundant reads, and maintains project context across sessions.

## Dashboard features

- Real-time RTK token savings (global + per-project)
- Daily and weekly usage charts
- OpenWolf project tracking
- Bilingual EN/ZH
- Auto-refresh every 30 seconds
