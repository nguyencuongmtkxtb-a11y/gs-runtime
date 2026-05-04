# System Architecture — GS Runtime

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    User / OpenCode Agent                  │
│  gs init → gs brainstorm → gs plan → gs implement → ...  │
└──────────────┬────────────────────────────┬──────────────┘
               │ CLI commands                │ MCP tools
               ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│     CLI (Commander)      │  │     MCP Server (stdio)        │
│  State Machine           │  │  gs_workflow_status           │
│  Context Injector        │  │  gs_check_file (phase gate)   │
│  Scaffold Generator      │  │  gs_pre_commit (security)     │
│  Session State Manager   │  │  gs_load_design_system        │
└──────────┬───────────────┘  │  gs_compose_design_prompt      │
           │                  └──────────────┬─────────────────┘
           │                                 │
           ▼                                 ▼
┌──────────────────────────────────────────────────────────┐
│                    Shared Layer                           │
│  State (load/save/transition)                             │
│  Session State (latest.md + archive)                      │
│  Hooks (privacy, scout, security, simplify, plan-format)  │
│  Types (Phase, GSState, PlanTask, MCP interfaces)         │
│  Logger (colored CLI output)                              │
└──────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│               External Dependencies                        │
│  GitNexus (code graph, optional)                          │
│  Open Design (design skills + systems, submodule)         │
│  Node.js fs (state persistence, file operations)          │
└──────────────────────────────────────────────────────────┘
```

## Component Details

### CLI (`src/cli/`)

The CLI is the user-facing entry point. Built with Commander.js.

| File | Purpose |
|------|---------|
| `index.ts` | Command definitions: init, brainstorm, plan, implement, review, finish, status, reset, config, agents-md, mcp-start, ui |
| `state-machine.ts` | Phase state machine: transitions, validation, GitNexus auto-index, session state integration, UI task detection |
| `context-injector.ts` | Generates AGENTS.md content + phase-specific instructions for agent prompts |
| `scaffold.ts` | Generates 14 project template files on `gs init` |

### MCP Server (`src/mcp/`)

The MCP server is the enforcement layer. OpenCode calls these tools before every action.

| File | Purpose |
|------|---------|
| `server.ts` | Main MCP server: 10 core tools + 5 design tools, hook integration, session context injection |
| `design-tools.ts` | Handlers for `gs_list_design_skills`, `gs_load_design_system`, `gs_search_design_systems`, `gs_detect_agents`, `gs_compose_design_prompt` |

### Design Module (`src/design/`)

Scans the Open Design submodule for skills, design systems, and agents.

| File | Purpose |
|------|---------|
| `skill-loader.ts` | Parses 59 SKILL.md files from `integrations/open-design/skills/` with YAML frontmatter |
| `design-system-loader.ts` | Loads 137 DESIGN.md files from `integrations/open-design/design-systems/` |
| `agent-detector.ts` | Detects 13 CLI agents on PATH (claude, opencode, codex, gemini, etc.) |
| `prompt-composer.ts` | Composes design prompts with anti-slop checklist, discovery forms, critique checklists |
| `context-injector.ts` | Injects design system context into agent prompts |
| `types.ts` | Shared types for the design module |

### Hooks (`src/hooks/`)

Tool-level enforcement that complements phase-level MCP enforcement.

| File | Purpose |
|------|---------|
| `privacy-block.ts` | Detects sensitive files (.env, credentials, .pem, .key) — returns AskUserQuestion prompt |
| `scout-block.ts` | Blocks access to high-noise directories (node_modules, dist, .git) via `.gsignore` |
| `security-scan.ts` | Scans staged files for hardcoded secrets (API keys, tokens, passwords, private keys, XSS, SQL injection) |
| `post-edit-simplify.ts` | Tracks edit count, reminds to run simplifier after 5+ edits |
| `plan-format-validator.ts` | Validates plan.md format after writes (descriptive links, no direct status edits) |

### Shared (`src/shared/`)

Core utilities used by all components.

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript types: Phase, GSState, PlanTask, MCPWorkflowStatus, MCPFileCheckResult, MCPPreCommitResult |
| `state.ts` | State persistence: .gs/state.json + ~/.gs/ global state, transitions, validation |
| `session-state.ts` | Session state: .gs/session/latest.md + archive rotation (5), resume context generation |
| `logger.ts` | Colored CLI output with section/step/code formatting |

## Data Flow

### `gs init` flow
```
User: gs init
  → CLI creates StateMachine
  → createInitialState() → idle phase, all others pending
  → scaffoldProject() → project template files
  → buildAgentsMd() → AGENTS.md with GS + Open Design rules
  → isGitNexusAvailable() ? autoIndex() : prompt install
  → ensureSessionDir() + createInitialSession()
  → persist state + save session
```

### `gs brainstorm "feature"` flow
```
User: gs brainstorm "tạo landing page..."
  → transitionTo("brainstorming")
  → Detect UI task via regex (ui|web|design|landing...)
  → If UI: output DESIGN section with gs ui + MCP steps
  → ensureGitNexusIndex()
  → Output phase instructions
  → persist state + update session
```

### `gs_check_file` flow (MCP)
```
Agent: gs_check_file({path: "src/feature.ts", operation: "write"})
  → Load GS state
  → Privacy check: sensitive file? → @@PRIVACY_PROMPT@@ block
  → Scout check: in blocked directory? → deny
  → Phase check: brainstorming/planning + write? → deny
  → Implementing + plan.tasks.length === 0? → allow with warning (plan.md fallback)
  → Plan check: implementing + unplanned file? → deny
  → Hook: track edit count, validate plan format
  → Allow
```

### `gs_record_output` flow (MCP)
```
Agent: gs_record_output({output: ".gs/plan.md"})
  → Load GS state
  → markPhaseComplete(currentPhase)
  → If planning: parsePlanTasks(plan.md) → populate plan.tasks
  → Update session via updateSessionFromState()
  → Return: "Phase X completed. Next: gs_propose_transition target Y"
  → NOTE: Does NOT auto-transition — agent must call gs_propose_transition explicitly
```

### `gs_propose_transition` flow (MCP)
```
Agent: gs_propose_transition({target_phase: "reviewing"})
  → Validate: current phase is completed
  → If brainstorming→planning: validate .gs/design.md exists (min 50 chars)
  → executeTransition(targetPhase)
  → If target is implementing or reviewing: reindexGitNexus() (force re-analyze)
  → Update session via updateSessionFromState()
  → Return success/failure
```

### `gs_pre_commit` flow (MCP)
```
Agent: gs_pre_commit()
  → Load GS state
  → Phase check: only implementing/reviewing/finishing
  → Security scan: scanStagedFiles()
    → git diff --cached --name-only
    → For each file: secret patterns, vulnerability patterns, sensitive file patterns
    → If critical: ready=false, block commit
    → Report: totalFindings, critical, high, medium, summary
```

## State Persistence

GS uses two layers of state:

### Project State (`.gs/state.json`)
```json
{
  "version": "1.0.0",
  "project": "my-project",
  "currentPhase": "implementing",
  "phases": {
    "idle": { "status": "completed" },
    "brainstorming": { "status": "completed", "output": ".gs/design.md" },
    "planning": { "status": "completed", "output": ".gs/plan.md" },
    "implementing": { "status": "in_progress" },
    ...
  },
  "plan": {
    "tasks": [
      { "id": "T1", "description": "...", "files": [...], "status": "completed" }
    ]
  }
}
```

### Session State (`.gs/session/latest.md`)
```markdown
# Session State — my-project
## Summary
- Phase: implementing
- Tasks Completed: 3
- Tasks Remaining: 5
## Modified Files
- src/feature.ts
## Resume Context
Resume from where you left off. Do NOT re-do completed work.
```

Archive: 5 most recent sessions stored in `.gs/session/archive/session-<timestamp>.md`

### Global State (`~/.gs/project-<name>.json`)
Mirror of project state for cross-session discovery.

## Security

- **Privacy block**: Intercepts reads on `.env`, `credentials.*`, `*.pem`, `*.key`, `*.pfx`, `id_rsa`, etc.
- **Scout block**: Blocks agent access to `node_modules/`, `dist/`, `.git/`, `coverage/` via `.gsignore`
- **Security scan**: Pre-commit check for API keys, tokens, passwords, private keys, XSS, SQL injection
- **Phase enforcement**: No file writes during brainstorming/planning, no unplanned files during implementing
