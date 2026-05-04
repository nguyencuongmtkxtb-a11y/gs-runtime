# Deployment Guide — GS Runtime

## Prerequisites

- **Node.js** >= 18 (>= 24 for Open Design web UI)
- **OpenCode** — https://opencode.ai
- **Git**
- **pnpm** (for Open Design web UI only)

## Quick Install (Windows)

```powershell
git clone --recurse-submodules https://github.com/user/gs-runtime.git
cd gs
powershell -ExecutionPolicy Bypass -File .\scripts\install-full.ps1
```

Script tự động:
1. Check Node.js
2. Clone GS repo + submodules
3. Install Superpowers skills
4. `npm install && npm run build && npm link`
5. Install GitNexus (optional)
6. Configure OpenCode MCP
7. Register GS + od-bridge skills

## Manual Install

```bash
# 1. Clone with Open Design submodule
git clone --recurse-submodules https://github.com/user/gs-runtime.git
cd gs

# 2. Install + build
npm install
npm run build
npm link

# 3. Install GitNexus (optional)
npm install -g gitnexus

# 4. Deploy skills
mkdir -p ~/.config/opencode/skills/gs
mkdir -p ~/.config/opencode/skills/od-bridge
cp skills/gs/SKILL.md ~/.config/opencode/skills/gs/SKILL.md
cp skills/od-bridge/SKILL.md ~/.config/opencode/skills/od-bridge/SKILL.md

# 5. Configure OpenCode
gs config  # copy output → ~/.config/opencode/config.json
```

## OpenCode MCP Configuration

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

Or combine with GitNexus:

```json
{
  "mcp": {
    "gs": {
      "type": "local",
      "command": ["gs", "mcp-start"]
    },
    "gitnexus": {
      "type": "local",
      "command": ["gitnexus", "mcp"]
    }
  }
}
```

## Initialize a Project

```bash
cd your-project
gs init
```

This creates:
```
your-project/
├── .editorconfig
├── .gitignore
├── .gsignore
├── .gs/state.json + session/
├── AGENTS.md (GS + Open Design rules)
├── CLAUDE.md
├── README.md
├── docs/ (5 files)
├── plans/templates/ (3 files)
└── rules/orchestration-protocol.md
```

## Start Workflow

```bash
gs brainstorm "your feature description"
# → OpenCode agent follows brainstorming workflow
# → Creates .gs/design.md

gs plan
# → Agent creates implementation plan
# → Analyzes blast radius with GitNexus

gs implement
# → Agent executes TDD: RED → GREEN → REFACTOR
# → Each file op validated via gs_check_file
# → Each commit checked via gs_pre_commit (security scan)

gs review
# → Agent reviews with GitNexus + Open Design critique

gs finish
# → Final checks, cleanup, merge prep
```

## Open Design Web UI (Optional)

Requires pnpm + built daemon:

```bash
cd integrations/open-design
pnpm install
pnpm --filter @open-design/daemon build
cd ../..
gs ui
# → Opens design system browser at http://127.0.0.1:3456
```

## Update

```bash
cd gs
git pull --recurse-submodules
npm run build
```

## Uninstall

```bash
npm unlink -g gs
rm -rf ~/.config/opencode/skills/gs
rm -rf ~/.config/opencode/skills/od-bridge
# Remove "gs" from ~/.config/opencode/config.json mcp section
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "GS not initialized" | Run `gs init` in project root |
| "Workflow already in progress" | Run `gs reset` then `gs init` |
| GitNexus not found | `npm install -g gitnexus` (optional) |
| Open Design tools return empty | Run `git submodule update --init` |
| `gs ui` fails to start | Run `cd integrations/open-design && pnpm install && pnpm --filter @open-design/daemon build` |
| Scout block blocks daemon | Restart OpenCode after updating `.ckignore` |
