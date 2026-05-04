# Project Overview — GS Runtime

## Purpose

**GS Runtime** is a unified development enforcement layer for OpenCode that combines three pillars into one CLI:

| Pillar | Role | Implementation |
|--------|------|---------------|
| **Superpowers** | Structured workflow methodology | 6-phase state machine (brainstorm → plan → implement → review → finish → completed) |
| **GitNexus** | Codebase graph intelligence | Symbol-level code graph with query, context, impact, detect_changes via MCP |
| **Open Design** | Design system enforcement | 59 design skills + 137 design systems, mandatory token usage, anti-slop rules |

GS ensures AI coding agents never skip steps, never use ad-hoc design, and always understand codebase impact before changing anything.

## Core Features

1. **Phase-gated workflow** — Every file operation is validated against the current phase. No code during brainstorming. No ad-hoc changes during implementation.
2. **TDD enforcement** — RED → GREEN → REFACTOR cycle required in implementing phase. No code before tests.
3. **GitNexus integration** — Real-time code graph: callers, callees, blast radius, execution flows. Pre-commit impact analysis.
4. **Open Design integration** — MCP tools for design system loading, skill discovery, prompt composition. Blocks ad-hoc CSS.
5. **Security scanning** — Pre-commit scan for hardcoded secrets, API keys, tokens, private keys, XSS vectors, SQL injection.
6. **Session state persistence** — Cross-session recovery. Resume exactly where you left off after context compaction.
7. **Scout block** — Blocks agent access to high-noise directories (node_modules, dist, .git) via `.gsignore`.
8. **Privacy block** — Intercepts sensitive file reads (.env, credentials) with AskUserQuestion flow.
9. **Project scaffold** — `gs init` generates production-standard project structure (docs, plans, gitignore, README, rules).
10. **Eval infrastructure** — Tier 1 static validation for SKILL.md files, frontmatter, required fields.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js >= 18 |
| Language | TypeScript 5.7 |
| CLI Framework | Commander |
| MCP Protocol | @modelcontextprotocol/sdk |
| State | JSON files (.gs/state.json) |
| Code Graph | GitNexus (peer dependency) |
| Design | Open Design submodule (integrations/open-design/) |

## Architecture

```
CLI (gs command)
  ├── State Machine (brainstorm → plan → implement → review → finish)
  ├── MCP Server (gatekeeper: gs_check_file, gs_pre_commit, etc.)
  ├── Design Module (skill-loader, system-loader, agent-detector, prompt-composer)
  ├── GitNexus Bridge (auto-index, context injection)
  ├── Hooks (privacy-block, scout-block, security-scan, simplify-reminder, plan-validator)
  └── Scaffold (project initialization templates)

MCP Tools (exposed to OpenCode agent)
  ├── gs_workflow_status, gs_check_file, gs_pre_commit (core)
  ├── gs_inject_context, gs_propose_transition, gs_complete_task, gs_record_output (workflow)
  ├── gs_list_design_skills, gs_search_design_systems, gs_load_design_system (design)
  ├── gs_detect_agents, gs_compose_design_prompt (design + prompt)
  └── GitNexus: query, context, impact, detect_changes, cypher (graph)
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| MCP-based enforcement over hooks | Structured RPC with validation responses, more robust than stdin/stdout parsing |
| Single `gs` skill with phase branching | Avoids subagent coordination overhead for workflow enforcement |
| JSON state files over SQLite | Zero dependencies, git-friendly, easy to inspect |
| Open Design as submodule | Independent versioning, 137 design systems shipped with project |
| Security scan at pre-commit | Catches secrets before they enter git history |
| Session state with archive rotation | Survives context compaction, 5-session history |

## Constraints

- Node.js >= 18 required
- GitNexus optional (degraded mode without graph context)
- pnpm required for Open Design web UI
- Open Design submodule must be initialized (`git submodule update --init`)
