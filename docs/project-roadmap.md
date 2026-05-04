# Project Roadmap — GS Runtime

## Phase 1: Core Foundation ✅

| Milestone | Status |
|-----------|--------|
| State machine (6-phase workflow) | ✅ Done |
| MCP server (gs_workflow_status, gs_check_file, gs_pre_commit) | ✅ Done |
| GitNexus integration (auto-index, context injection) | ✅ Done |
| CLI commands (init, brainstorm, plan, implement, review, finish) | ✅ Done |
| Project scaffold (gs init) | ✅ Done |
| AGENTS.md auto-generation | ✅ Done |
| Open Design submodule | ✅ Done |

## Phase 2: Open Design Integration ✅

| Milestone | Status |
|-----------|--------|
| 59 design skills loading via MCP | ✅ Done |
| 137 design systems via MCP | ✅ Done |
| Agent detection (13 CLI agents) | ✅ Done |
| Design prompt composition | ✅ Done |
| Anti-slop enforcement | ✅ Done |
| OD-bridge skill | ✅ Done |

## Phase 3: Advanced Enforcement ✅

| Milestone | Status |
|-----------|--------|
| Session state & compact recovery | ✅ Done |
| Privacy block (sensitive file detection) | ✅ Done |
| Scout block (.gsignore directory blocking) | ✅ Done |
| Security scan (pre-commit secret/vulnerability detection) | ✅ Done |
| Plan format validation | ✅ Done |
| Post-edit simplify reminder | ✅ Done |
| Eval infrastructure (Tier 1 static validation) | ✅ Done |
| Specialized agent roles (planner, reviewer, simplifier, tester) | ✅ Done |
| Orchestration protocol | ✅ Done |

## Phase 4: Web UI & Polish ✅

| Milestone | Status |
|-----------|--------|
| `gs ui` command (Open Design web UI launcher) | ✅ Done |
| UI task auto-detection in brainstorm | ✅ Done |
| Daemon + Next.js web app integration | ✅ Done |
| Design system browser (129+ systems visual) | ✅ Done |

## Phase 5: Production Hardening (Current)

| Milestone | Status |
|-----------|--------|
| Unit tests for all hooks | ⬜ Todo |
| Eval Tier 2 (E2E CLI spawn tests) | ⬜ Todo |
| Eval Tier 3 (LLM judge) | ⬜ Todo |
| Subagent context injection (GS context for @mention subagents) | ⬜ Todo |
| Notification system (Telegram/Discord/Slack on phase transitions) | ⬜ Todo |
| Config system (.gs/config.json with hook toggles) | ⬜ Todo |
| Coding output levels (ELI5 → God Mode) | ⬜ Todo |

## Future

- **Multi-project dashboard** — View all GS-managed projects in one place
- **Git hooks integration** — Auto-run `gs_pre_commit` via husky
- **CI/CD integration** — GS workflow as GitHub Actions
- **Plugin system** — Third-party hooks and skills
- **Cross-platform desktop app** — Electron wrapper for `gs ui`
