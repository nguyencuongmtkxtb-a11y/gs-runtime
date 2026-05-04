# GS Runtime — Superpowers + GitNexus + Open Design

GS is a unified development runtime that combines three pillars into one enforced workflow for OpenCode.

| Pillar | What it does |
|--------|-------------|
| **Superpowers** | Structured workflow methodology (brainstorm → plan → implement → review → finish) |
| **GitNexus** | Codebase graph intelligence (blast radius, execution flows, dependency analysis) |
| **Open Design** | Design system integration (59 skills, 137 design systems, mandatory token usage) |

## Quick Start

```bash
cd your-project
gs init           # One-time setup. That's it.

# Open OpenCode, tell agent what to do:
# "Add OAuth2 login with Google"
# "Fix the null pointer in auth middleware"
# Agent handles the entire workflow automatically.
```

**No other terminal commands needed.** Agent starts workflows, transitions phases, and finishes — all via MCP.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Terminal: gs init (one-time)                         │
├─────────────────────────────────────────────────────┤
│  OpenCode Agent (handles everything after init):     │
│                                                      │
│  gs_start_workflow → brainstorm → plan → implement   │
│                      → review → finish               │
├─────────────────────────────────────────────────────┤
│  MCP Server (gatekeeper):                            │
│  - gs_workflow_status: current phase + instructions  │
│  - gs_start_workflow: begin full/quick workflow       │
│  - gs_check_file: validates write operations         │
│  - gs_pre_commit: security scan before commits       │
│  - gs_propose_transition: auto phase transition      │
│  - gs_register_task: explicit task registration      │
│  - gs_complete_task: mark tasks done                 │
│  - gs_record_output: mark phase complete             │
│  - gs_inject_context: GitNexus graph hints           │
│  + 5 Open Design tools (list, load, search,          │
│    detect agents, compose prompt)                    │
├─────────────────────────────────────────────────────┤
│  GitNexus Bridge (orchestration-only):               │
│  - Auto-index on phase start                         │
│  - Actual queries via GitNexus's own MCP server      │
├─────────────────────────────────────────────────────┤
│  Open Design Module:                                 │
│  - 59 design skills (12 scenarios)                   │
│  - 137 design systems (19 categories)                │
│  - Prompt composition (anti-slop enforced)           │
└─────────────────────────────────────────────────────┘
```

## How It Works

1. **User** runs `gs init` once in terminal
2. **User** opens OpenCode and describes what they want
3. **Agent** calls `gs_start_workflow` — picks `full` or `quick` mode automatically
4. **Agent** executes the workflow end-to-end, transitioning phases via MCP
5. **MCP server** enforces rules: no code during brainstorm, security scan before commits, plan task gate during implement

### Two Modes

| Mode | When | What happens |
|------|------|--------------|
| **full** | Complex features, multi-file changes | brainstorm → plan → implement → review → finish |
| **quick** | Bug fixes, small refactors, < 5 min tasks | Straight to implementing, relaxed rules |

The agent decides which mode based on the user's request complexity.

## Installation

### Automatic (Windows) — 1 command
```powershell
git clone --recurse-submodules https://github.com/nguyencuongmtkxtb-a11y/gs-runtime.git
cd gs-runtime
powershell -ExecutionPolicy Bypass -File .\scripts\install-full.ps1
```

### Manual steps

```bash
# Prerequisites: Node.js >= 18, OpenCode, Git

# 1. Install Superpowers skills
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp
cp -r /tmp/sp/skills/* ~/.config/opencode/skills/
rm -rf /tmp/sp

# 2. Clone + install GS (includes Open Design submodule)
git clone --recurse-submodules https://github.com/nguyencuongmtkxtb-a11y/gs-runtime.git
cd gs-runtime
npm install && npm run build && npm link

# 3. Install GitNexus (optional — graph intelligence)
npm install -g gitnexus@1.6.4-rc.48

# 4. Deploy skills + config
mkdir -p ~/.config/opencode/skills/gs
cp skills/gs/SKILL.md ~/.config/opencode/skills/gs/SKILL.md
mkdir -p ~/.config/opencode/skills/od-bridge
cp skills/od-bridge/SKILL.md ~/.config/opencode/skills/od-bridge/SKILL.md
gs config  # Copy output into ~/.config/opencode/config.json
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
  }
}
```

## Usage in Your Project

```bash
cd your-project
gs init    # Done. Go to OpenCode.
```

Then in OpenCode, just describe your task naturally:
- "Add user authentication with OAuth2 and refresh tokens"
- "Fix the race condition in the payment webhook handler"
- "Redesign the settings page" (agent will detect UI task)

### Optional CLI Commands

These are available if you want manual control, but **not required**:

| Command | Description |
|---------|-------------|
| `gs init` | Initialize GS in project (required, one-time) |
| `gs status` | Show current workflow status |
| `gs reset` | Reset all workflow state |
| `gs quick <desc>` | Force quick mode from terminal |
| `gs brainstorm [--ui] <desc>` | Force full mode from terminal |
| `gs plan` | Manually start planning phase |
| `gs implement` | Manually start implementation phase |
| `gs review` | Manually start review phase |
| `gs finish` | Manually finish workflow |
| `gs index` | Force GitNexus re-indexing |
| `gs config` | Show OpenCode MCP config |
| `gs ui` | Open Design web UI browser |

## Enforcement Layers

1. **MCP Server** — blocks unauthorized operations (writes during brainstorm, unplanned files during implement, commits without security scan)
2. **System Instructions** — AGENTS.md + gs skill guide agent behavior
3. **Hooks** — privacy block, scout block, security scan, edit-simplify reminder, plan format validator

If agent "forgets" rules → MCP rejects the operation.
If MCP is bypassed → system instructions prevent it.

## Open Design (UI Tasks)

When `--ui` flag is passed (or agent detects UI task), Open Design enforcement activates:

- **59 design skills** for prototypes, dashboards, mobile, presentations
- **137 design systems** with full DESIGN.md tokens (Linear, Stripe, Apple, etc.)
- **Mandatory**: all CSS colors, fonts, spacing from loaded design system
- **Anti-slop**: no Lorem ipsum, no ad-hoc hex values

## Testing

```bash
npm test           # Run unit tests (vitest)
npm run typecheck  # TypeScript check
npm run build      # Build to dist/
```

## State & Persistence

- Local: `.gs/state.json` (per-project)
- Global: `~/.gs/project-<name>.json` (backup)
- Session: `.gs/session/latest.md` (cross-session recovery)
- Atomic writes prevent corruption from concurrent access

## Security

- Pre-commit scan detects hardcoded secrets, API keys, private keys
- Configurable rules via `.gs/security-rules.json`
- Privacy hook blocks sensitive file reads until user approval
- Scout block prevents access to noise directories (node_modules, dist, .git)
