# RTK Dashboard

[中文文档](#中文文档) | [English](#english)

---

## English

One-click setup for **RTK** + **OpenWolf** token savings dashboard. Supports Claude Code, Codex, and OpenCode.

### What is this?

When you use Claude Code, RTK runs as a background hook that intercepts CLI command output (git, ls, cat, etc.) and compresses it before sending to Claude — saving 40-90% of tokens per command. OpenWolf adds a persistent memory layer on top of that.

**This dashboard** visualizes exactly how many tokens you've saved, per project, with charts and breakdowns. You get a clear picture of where your tokens go and how much RTK catches.

### One-Click Install

```bash
npx rtk-dashboard setup
```

That's it. This single command will:

1. Detect your platform (Claude Code / Codex / OpenCode)
2. Install Python Flask if missing
3. Install RTK if missing (`cargo install rtk`)
4. Install OpenWolf if missing (`npm install -g openwolf`)
5. Configure CLI hooks for all detected platforms
6. Start the web dashboard at `http://localhost:5678`

### Prerequisites

| Dependency | What it is | Required? | Install |
|---|---|---|---|
| **Node.js 16+** | Runs the setup CLI | Yes | [nodejs.org](https://nodejs.org) |
| **Python 3.8+** | Runs the dashboard server | Auto-installed | [python.org](https://python.org) |
| **Flask** | Python web framework | Auto-installed | `pip install flask` |
| **RTK** | Token-saving CLI proxy | Auto-installed | `cargo install rtk` |
| **OpenWolf** | Persistent AI memory layer | Optional | `npm install -g openwolf` |
| **Cargo** | Rust package manager | Only if installing RTK via cargo | [rustup.rs](https://rustup.rs) |

### CLI Commands

```bash
npx rtk-dashboard setup     # One-click install & configure everything
npx rtk-dashboard start     # Start the dashboard
npx rtk-dashboard status    # Check installation status
```

Or install globally:

```bash
npm install -g rtk-dashboard
rtk-dashboard setup
```

### Supported Platforms

| Platform | Hook Config | Auto-configured? |
|---|---|---|
| **Claude Code** | `~/.claude/settings.json` | Yes |
| **Codex** | `~/.codex/config.json` | Yes |
| **OpenCode** | `~/.opencode/config.json` | Yes |

### How does it work?

```
Claude Code  →  RTK (hook)  →  Real CLI commands
      ↓
  Token savings logged to rtk gain
      ↓
  Dashboard reads via rtk gain -a -f json
```

1. RTK runs as a Claude Code hook, intercepting and compressing command output
2. RTK logs token usage per command, per project
3. This dashboard queries RTK's data via `rtk gain -a -f json` and displays it in real-time

OpenWolf adds a `.wolf/` directory to each project that tracks file reads/writes and prevents redundant reads — its ledger is read directly by the dashboard.

### Pages

| Page | URL | What it shows |
|---|---|---|
| **Overview** | `/` | Global RTK stats, daily/weekly charts, OpenWolf summary |
| **Projects** | `/projects` | Add/remove projects, per-project RTK stats, OpenWolf init |

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/tokens` | GET | All token data (summary + daily + weekly) |
| `/api/tokens/summary` | GET | Summary: total calls, input/output, cache rate |
| `/api/tokens/daily` | GET | Daily token usage breakdown |
| `/api/tokens/session` | GET | Current session token data |
| `/api/tokens/log` | GET | Raw log entries (last N) |
| `/api/global` | GET | Global RTK CLI compression stats |
| `/api/global/quota` | GET | Quota projection |
| `/api/projects` | GET/POST/DELETE | Manage projects |
| `/api/project?path=...` | GET | Per-project RTK stats |
| `/api/openwolf/init` | POST | Initialize OpenWolf |
| `/api/openwolf/status?path=...` | GET | OpenWolf status and ledger data |

### File Structure

```
rtk-dashboard/
├── bin/rtk-dashboard.js     # CLI entry point
├── src/
│   ├── setup.js             # Setup orchestrator
│   ├── platforms.js         # Platform detection
│   ├── hooks.js             # Hook configuration
│   ├── token-tracker.js     # PostToolUse hook (real token data)
│   └── aggregate.js         # Data aggregation (JS)
├── rtk_dashboard.py         # Flask backend + token APIs
├── dashboard.html           # Overview page (3-section design)
├── projects.html            # Project management page
├── package.json             # npm package
├── skill.md                 # Claude Code skill definition
├── start.bat                # Windows one-click launcher
└── start.sh                 # Mac/Linux one-click launcher
```

### Language

Click the toggle button in the top-right to switch between English and Chinese. Your choice is saved in browser localStorage.

---

## 中文文档

一键安装 **RTK** + **OpenWolf** Token 节省仪表盘。支持 Claude Code、Codex 和 OpenCode。

### 这是什么？

使用 Claude Code 时，RTK 作为后台 Hook 运行，拦截 CLI 命令输出（git、ls、cat 等），在发送给 Claude 之前进行压缩，每个命令可节省 40-90% 的 Token。OpenWolf 在此基础上提供持久化记忆层。

**本仪表盘**可视化展示你节省了多少 Token，按项目分类，配有图表和详细分解。你可以清楚地看到 Token 的去向和 RTK 拦截了多少。

### 一键安装

```bash
npx rtk-dashboard setup
```

完成。这一条命令会自动：

1. 检测你的平台（Claude Code / Codex / OpenCode）
2. 安装 Python Flask（如未安装）
3. 安装 RTK（如未安装）
4. 安装 OpenWolf（如未安装）
5. 为所有检测到的平台配置 CLI hooks
6. 启动 Web 仪表盘 `http://localhost:5678`

### 环境要求

| 依赖 | 用途 | 是否必须 | 安装方式 |
|---|---|---|---|
| **Node.js 16+** | 运行安装 CLI | 是 | [nodejs.org](https://nodejs.org) |
| **Python 3.8+** | 运行仪表盘服务器 | 自动安装 | [python.org](https://python.org) |
| **Flask** | Python Web 框架 | 自动安装 | `pip install flask` |
| **RTK** | Token 节省 CLI 代理 | 自动安装 | `cargo install rtk` |
| **OpenWolf** | 持久化 AI 记忆层 | 可选 | `npm install -g openwolf` |
| **Cargo** | Rust 包管理器 | 仅 cargo 安装 RTK 时需要 | [rustup.rs](https://rustup.rs) |

### CLI 命令

```bash
npx rtk-dashboard setup     # 一键安装并配置所有内容
npx rtk-dashboard start     # 启动仪表盘
npx rtk-dashboard status    # 检查安装状态
```

或全局安装：

```bash
npm install -g rtk-dashboard
rtk-dashboard setup
```

### 支持的平台

| 平台 | Hook 配置文件 | 自动配置？ |
|---|---|---|
| **Claude Code** | `~/.claude/settings.json` | 是 |
| **Codex** | `~/.codex/config.json` | 是 |
| **OpenCode** | `~/.opencode/config.json` | 是 |

### 工作原理

```
Claude Code  →  RTK (Hook)  →  真实 CLI 命令
      ↓
  Token 节省数据记录到 rtk gain
      ↓
  仪表盘通过 rtk gain -a -f json 读取并展示
```

1. RTK 作为 Claude Code 的 Hook 运行，拦截并压缩命令输出
2. RTK 按命令、按项目记录 Token 使用量
3. 本仪表盘通过 `rtk gain -a -f json` 查询 RTK 数据，实时展示

OpenWolf 在每个项目中添加 `.wolf/` 目录，追踪文件读写并防止重复读取 — 仪表盘直接读取其账本文件。

### 页面说明

| 页面 | URL | 内容 |
|---|---|---|
| **概览** | `/` | 全局 RTK 数据、每日/每周图表、OpenWolf 摘要 |
| **项目管理** | `/projects` | 添加/移除项目、项目级 RTK 数据、OpenWolf 初始化 |

### API 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/api/tokens` | GET | 全部 token 数据（汇总 + 每日 + 每周） |
| `/api/tokens/summary` | GET | 汇总：总调用、输入/输出、缓存命中率 |
| `/api/tokens/daily` | GET | 每日 token 使用明细 |
| `/api/tokens/session` | GET | 当前会话 token 数据 |
| `/api/tokens/log` | GET | 原始日志（最近 N 条） |
| `/api/global` | GET | 全局 RTK CLI 压缩统计 |
| `/api/global/quota` | GET | 额度预测 |
| `/api/projects` | GET/POST/DELETE | 管理项目 |
| `/api/project?path=...` | GET | 项目级 RTK 数据 |
| `/api/openwolf/init` | POST | 初始化 OpenWolf |
| `/api/openwolf/status?path=...` | GET | OpenWolf 状态和账本数据 |

### 文件结构

```
rtk-dashboard/
├── bin/rtk-dashboard.js     # CLI 入口
├── src/
│   ├── setup.js             # 安装编排器
│   ├── platforms.js         # 平台检测
│   ├── hooks.js             # Hook 配置
│   ├── token-tracker.js     # PostToolUse hook（真实 token 数据）
│   └── aggregate.js         # 数据聚合（JS）
├── rtk_dashboard.py         # Flask 后端 + token API
├── dashboard.html           # 概览页（三区设计）
├── projects.html            # 项目管理页
├── package.json             # npm 包配置
├── skill.md                 # Claude Code Skill 定义
├── start.bat                # Windows 一键启动
└── start.sh                 # Mac/Linux 一键启动
```

### 语言切换

点击右上角的切换按钮可在中英文之间切换。选择会保存在浏览器 localStorage 中。

---

## License

MIT
