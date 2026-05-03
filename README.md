# GS Runtime - Superpowers + GitNexus Bridge

GS is a CLI runtime that enforces a strict software development workflow combining Superpowers methodology with GitNexus graph intelligence for OpenCode.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  User → gs CLI (orchestrator)                    │
│  Only way to interact with the workflow          │
├─────────────────────────────────────────────────┤
│  State Machine:                                  │
│  idle → brainstorm → plan → implement            │
│          → review → finish → completed           │
├─────────────────────────────────────────────────┤
│  MCP Server (gatekeeper):                        │
│  - gs_workflow_status: returns current phase     │
│  - gs_check_file: validates file operations      │
│  - gs_pre_commit: pre-commit validation          │
│  - gs_inject_context: GitNexus graph context     │
│  - gs_propose_transition: phase transition       │
├─────────────────────────────────────────────────┤
│  GitNexus Bridge:                                │
│  - Auto-index on phase start                     │
│  - Graph context injection                       │
│  - Impact analysis for code review               │
│  - Change detection for commits                  │
└─────────────────────────────────────────────────┘
```

## Installation (máy mới hoàn toàn)

### Cách 1: Tự động (Windows) — 1 lệnh
```powershell
git clone https://github.com/nguyencuongmtkxtb-a11y/gs-runtime.git
cd gs
powershell -ExecutionPolicy Bypass -File .\scripts\install-full.ps1
```
Script tự động 7 bước:
1. Check Node.js >= 18
2. Clone/setup GS repo
3. **Cài Superpowers skills** (từ github.com/obra/superpowers)
4. npm install + build + npm link
5. Cài GitNexus (graph context)
6. Config OpenCode (MCP servers)
7. Register GS skill

### Cách 2: Từng bước thủ công

```bash
# 0. Prerequisites
#    - Node.js >= 18
#    - OpenCode (opencode.ai)
#    - Git

# 1. Cài Superpowers skills
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
cp -r /tmp/sp/skills/* ~/.config/opencode/skills/
rm -rf /tmp/sp

# 2. Clone + cài GS
git clone https://github.com/nguyencuongmtkxtb-a11y/gs-runtime.git
cd gs
npm install && npm run build && npm link

# 3. Cài GitNexus (graph context - tùy chọn)
npm install -g gitnexus@1.6.4-rc.48

# 4. Config OpenCode
mkdir -p ~/.config/opencode/skills/gs
cp skills/gs/SKILL.md ~/.config/opencode/skills/gs/SKILL.md
gs config  # copy output vào ~/.config/opencode/config.json
```

### Sau khi cài: dùng trong project

```bash
cd your-project
gs init                    # Khởi tạo GS
gs brainstorm "your feature"  # CHỈ 1 LẦN - mọi thứ khác tự động qua MCP

# Sau đó mở OpenCode, agent tự quản lý toàn bộ workflow:
# brainstorm → plan → implement → review → finish
# Có thể rollback: review → implement (sửa bug) → review
```

### Cập nhật
```bash
cd gs
git pull
npm run build
```

### Configure OpenCode

Add to `~/.config/opencode/config.json`:
```json
{
  "mcp": {
    "gs": {
      "type": "local",
      "command": ["gs", "mcp-start"]
    }
  },
  "plugin": ["gs@git+https://github.com/user/gs.git"]
}
```

Or just run:
```bash
gs config
```
And copy the output into your OpenCode config.

### Initialize in your project
```bash
cd your-project
gs init
gs agents-md    # Creates AGENTS.md with mandatory rules
```

## Usage

### Full Workflow
```bash
gs brainstorm "Add user authentication with OAuth2"
# Go to OpenCode → agent follows brainstorming workflow
# Agent creates design doc → proposes transition

gs plan
# Go to OpenCode → agent creates implementation plan
# Agent analyzes blast radius with GitNexus

gs implement
# Go to OpenCode → agent executes TDD cycle
# Each file op validated, each commit checked

gs review
# Go to OpenCode → agent reviews with GitNexus impact

gs finish
# Final checks, cleanup, merge prep
```

### Commands
| Command | Description |
|---------|-------------|
| `gs init` | Initialize GS in project |
| `gs brainstorm <desc>` | Start brainstorming phase |
| `gs plan` | Start planning phase |
| `gs implement` | Start implementation phase |
| `gs review` | Start code review phase |
| `gs finish` | Finish the workflow |
| `gs status` | Show current workflow status |
| `gs reset` | Reset all workflow state |
| `gs index` | Force GitNexus re-indexing |
| `gs config` | Show OpenCode MCP config |
| `gs agents-md` | Generate AGENTS.md |
| `gs mcp-start` | Start MCP server (called by OpenCode) |

## How Enforcement Works

GS enforces the workflow through three layers:

1. **CLI Gatekeeper**: Users can only start phases in order. The CLI validates state before allowing transitions.

2. **MCP Server**: Every file operation must be validated. `gs_check_file` blocks writes during brainstorming/planning. `gs_pre_commit` blocks commits outside implementing phase.

3. **System Instructions**: AGENTS.md and the gs skill embed mandatory rules into every conversation. The agent is instructed to call MCP tools before any action.

Even if the AI agent "forgets" to follow rules, the MCP server will reject unauthorized operations. Even if the MCP server is bypassed, the CLI will reject phase transitions with incomplete work.

## State Persistence

State is stored in `.gs/state.json` and globally in `~/.gs/project-<name>.json`.
All state is committed to the project (`.gs/` is gitignored by default).

## GitNexus Integration

GS automatically indexes the codebase with GitNexus when starting each phase.
If GitNexus is not available, GS operates in degraded mode (no graph context) but still enforces the workflow.
