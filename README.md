# Maestro

A macOS desktop app for orchestrating multiple AI coding agents (Claude Code, Codex, Cursor) in parallel on isolated git worktrees, with full PR/MR lifecycle management for GitHub and GitLab.

## Why Maestro?

Existing tools like [Conductor](https://conductor.build) and [Crystal](https://github.com/nichochar/crystal) lack support for Cursor and/or GitLab. Maestro fills both gaps — run any combination of agents side-by-side, each in its own worktree, with unified PR management across platforms.

## Features

- **Multi-agent support** — Claude Code, Codex, and Cursor, all via their CLIs with streaming output
- **Isolated worktrees** — each workspace gets its own `git worktree`, so agents never conflict
- **GitHub + GitLab** — create, review, and merge PRs/MRs via `gh` and `glab` CLIs
- **Diff viewer** — inline diff display with file list and change counts
- **Checkpoints** — snapshot worktree state before each agent turn, revert with one click
- **Terminal** — built-in terminal per workspace
- **Todos** — per-workspace task list that can block merge
- **Command palette** — Cmd+K to search commands, workspaces, and projects
- **Keyboard shortcuts** — Cmd+B (sidebar), Cmd+N (new workspace), Cmd+Shift+P (create PR), Cmd+D (diff), Ctrl+Z (zen mode)

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron |
| Frontend | React 19, Mantine UI 7 |
| State | Zustand |
| Database | better-sqlite3 (WAL mode) |
| Monorepo | pnpm workspaces |
| Build | Vite (renderer), tsc (main), electron-builder |

## Project Structure

```
maestro/
├── packages/
│   ├── main/           # Electron main process
│   │   └── src/
│   │       ├── ipc/            # IPC handlers (12 modules)
│   │       ├── services/       # Business logic
│   │       │   ├── agents/     # Claude Code, Codex, Cursor managers
│   │       │   └── git-platforms/  # GitHub, GitLab abstractions
│   │       └── database/       # SQLite schema + migrations
│   ├── renderer/       # React frontend
│   │   └── src/
│   │       ├── components/     # 18 UI components
│   │       ├── hooks/          # Keyboard shortcuts
│   │       ├── stores/         # Zustand state
│   │       └── services/       # IPC client
│   └── shared/         # Types + constants
└── scripts/
    └── dev.ts          # Dev launcher
```

## Prerequisites

- **Node.js** >= 20
- **pnpm** >= 9
- At least one agent CLI installed:
  - `claude` — [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
  - `codex` — [OpenAI Codex](https://github.com/openai/codex)
  - `cursor` — [Cursor](https://cursor.com)
- For PR/MR support:
  - `gh` — [GitHub CLI](https://cli.github.com)
  - `glab` — [GitLab CLI](https://gitlab.com/gitlab-org/cli)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm dev
```

This launches the Vite dev server for the renderer and starts Electron pointed at it.

## Building

```bash
# Build all packages
pnpm build

# Package as macOS DMG
pnpm package
```

## Data Storage

All data lives in `~/.maestro/`:

| Path | Contents |
|------|----------|
| `maestro.db` | SQLite database (projects, workspaces, sessions, messages, etc.) |
| `config.json` | API keys, default agent, model preferences |
| `logs/` | Daily log files |

## Architecture

### Agent Integration

Each agent is managed through an abstract `BaseAgentManager` class. Agents are spawned as child processes using their CLIs with streaming JSON output. The `AgentRegistry` discovers which agents are available on PATH at startup.

| Agent | CLI | Output Format | Special Features |
|-------|-----|--------------|-----------------|
| Claude Code | `claude` | NDJSON (`--output-format stream-json`) | Session resume via `--resume` |
| Codex | `codex` | JSONL (`--quiet`) | — |
| Cursor | `cursor` | NDJSON (`--output-format stream-json`) | Watchdog timer (120s) for hang detection |

### Git Platform Abstraction

GitHub and GitLab are supported through a `BaseGitPlatform` abstraction. The platform is auto-detected from the `origin` remote URL. All operations use the respective CLI tools (`gh`, `glab`).

### IPC

The main and renderer processes communicate through Electron IPC. All channels are defined as typed constants in `@maestro/shared`. The preload script exposes a typed `window.maestro` API with `invoke`, `on`, and `send` methods.

## License

MIT
