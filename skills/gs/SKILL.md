---
name: gs
description: ALWAYS load this skill FIRST in ANY GS-managed project. Unified Superpowers + GitNexus + Open Design workflow: brainstorm → plan → implement → review → finish. MANDATORY - NO EXCEPTIONS.
---

# GS - Superpowers + GitNexus + Open Design Unified Workflow

You are working in a project managed by GS Runtime. GS enforces a strict workflow that combines Superpowers methodology, GitNexus graph intelligence, and Open Design integration.

## CORE RULE

**Every action you take MUST be within the current workflow phase. You cannot skip phases, write code during brainstorming, or commit during planning.** The MCP server validates every operation.

## Open Design — MANDATORY Integration

GS now includes **Open Design** as a hard requirement for any task involving UI, frontend, visuals, presentations, or client-facing output.

### When Open Design MUST be used (non-negotiable):

| Trigger | Mandatory Action |
|---------|-----------------|
| Any UI/frontend task | `gs_load_design_system` to get design tokens |
| Any visual output (web, mobile, dashboard, PPT) | `gs_compose_design_prompt` with appropriate skill + system |
| Design ideation / wireframing | `gs_list_design_skills` to find the right skill |
| Design system not yet chosen | `gs_search_design_systems` to find matching system |
| Reviewing UI changes | `gs_compose_design_prompt` in critique mode |

### CRITICAL Rules:
- **NEVER use ad-hoc colors, fonts, or spacing** — use ONLY tokens from the loaded design system
- **NEVER use Lorem ipsum** — all copy must be contextual and real
- **NEVER skip design token loading** before generating UI code
- **ALWAYS load the design system BEFORE writing any CSS/styling**

## Mandatory First Action

Before ANY other action (including reading files, searching code, or loading other skills), you MUST:

```
Call: gs_workflow_status
```

This returns your current phase and instructions. Any tool call you make before this will be blocked.

## Phase Workflows

### If phase is "brainstorming":
1. Ask clarifying questions about requirements, constraints, edge cases
2. Use GitNexus `query` to find existing patterns related to the feature
3. Use GitNexus `context` on key symbols to understand the codebase
4. **DESIGN (if UI/visual task):** Call `gs_list_design_skills` to identify relevant skills for the task scope
5. **DESIGN (if UI/visual task):** Call `gs_search_design_systems` with appropriate keyword to find matching design system
6. **DESIGN (if UI/visual task):** Call `gs_compose_design_prompt` in discovery mode to explore design direction
7. Propose architecture and design decisions
8. Validate each decision with the user
9. Write design document to `.gs/design.md` (include chosen design system and skills)
10. Call `gs_record_output` with the design document path
11. Call `gs_propose_transition` with target "planning"

**During brainstorming, you are ONLY allowed to READ files. Do NOT write code.**
**CRITICAL: For UI tasks, you MUST include design system choice in the design document.**

### If phase is "planning":
1. Read the design document at `.gs/design.md`
2. Use GitNexus `impact` to calculate blast radius for each component that will change
3. Use GitNexus `context` to find all callers/callees of affected symbols
4. **DESIGN (if UI/visual task):** Call `gs_load_design_system` with the name from the design document to get full tokens (colors, fonts, spacing, components)
5. **DESIGN (if UI/visual task):** Call `gs_compose_design_prompt` with the chosen skill + design system to get the full design brief
6. Break work into tasks of 2-5 minutes each
7. For each task, specify:
   - Exact file paths to create/modify
   - Test file and test cases
   - Expected code structure (follow existing patterns)
   - **Design tokens reference** (colors, fonts, spacing from loaded design system)
   - Verification steps
8. Write plan to `.gs/plan.md`
9. Register tasks via GS MCP (if available) or write to state
10. Call `gs_record_output` with the plan document path
11. Call `gs_propose_transition` with target "implementing"

**During planning, you are ONLY allowed to READ files. Do NOT write code.**
**CRITICAL: Every UI task in the plan MUST reference the loaded design system tokens.**

### If phase is "implementing":
1. Read the plan from `.gs/plan.md`
2. **DESIGN (BEFORE any UI code):** Call `gs_compose_design_prompt` with the skill + design system from the plan — this is MANDATORY before writing any CSS/styling
3. **DESIGN (BEFORE any UI code):** Keep the loaded design system tokens visible — all colors, fonts, spacing MUST come from the design system, NOT ad-hoc values
4. For EACH task, follow strict TDD (Test-Driven Development):
   ```
   RED:   Call gs_check_file BEFORE writing test file
          Write the failing test
          Run test → confirm it FAILS
   GREEN: Write minimal implementation code
          Run test → confirm it PASSES
   REFACTOR: Clean up code while keeping tests green
   ```
5. Before EACH file operation, call `gs_check_file` with the file path
6. Before EACH commit, call `gs_pre_commit`
7. After commit, GitNexus index will be refreshed (if hooks installed)
8. Call `gs_complete_task` after each task is done
9. When all tasks done, call `gs_record_output`
10. Call `gs_propose_transition` with target "reviewing"

**CRITICAL: NEVER write code before its test. NEVER skip gs_check_file.**
**CRITICAL: If a test is deleted because code was written first, start over.**
**CRITICAL: NEVER write CSS/styling without first loading design system tokens.**
**CRITICAL: NEVER use ad-hoc hex colors, font sizes, or spacing — everything MUST come from the design system.**

### If phase is "reviewing":
1. Use GitNexus `detect_changes` to see all modified code
2. Use GitNexus `impact` to verify blast radius of changes
3. Review each changed file against the plan
4. **DESIGN (if UI changes):** Call `gs_compose_design_prompt` in critique mode with the design system to run 5-dimension design review (philosophy, hierarchy, detail, function, innovation)
5. **DESIGN (if UI changes):** Verify all colors, fonts, spacing match the loaded design system tokens — flag any ad-hoc values as violations
6. Verify all tests pass
7. Check for security, performance, and code quality issues
8. Report issues by severity (critical blocks merge) — design violations are HIGH severity
9. Call `gs_record_output` with review summary
10. Call `gs_propose_transition` with target "finishing"

### If phase is "finishing":
1. Run full test suite
2. Use GitNexus `detect_changes` for final impact check
3. Clean up temporary files
4. Update documentation if needed
5. Present merge/PR options to user
6. Call `gs_record_output`
7. Call `gs_propose_transition` with target "completed"

## GitNexus Tool Usage Guide

When GitNexus is indexed, prefer these tools over manual search:

| Tool | When to use |
|------|-------------|
| `query` | Find symbols, processes, or patterns by concept/name |
| `context` | Inspect a specific symbol's dependencies and callers |
| `impact` | Calculate blast radius before changing a symbol |
| `detect_changes` | See what changed and what's affected (pre-commit) |
| `cypher` | Custom graph queries (use `gitnexus://repo/{name}/schema` first) |
| `list_repos` | Discover all indexed repositories |

## Open Design Tool Usage Guide — MANDATORY for UI Tasks

These tools MUST be called at the specified phases for any task involving UI, frontend, visuals, presentations, or client-facing output:

| Tool | Phase | Required | Purpose |
|------|-------|----------|---------|
| `gs_list_design_skills` | brainstorming | YES (UI tasks) | Find relevant design skills by scenario |
| `gs_search_design_systems` | brainstorming | YES (UI tasks) | Find matching design system by keyword |
| `gs_compose_design_prompt` | brainstorming | YES (UI tasks) | Explore design direction (discovery mode) |
| `gs_load_design_system` | planning | YES (UI tasks) | Load all design tokens before planning UI tasks |
| `gs_compose_design_prompt` | planning | YES (UI tasks) | Get design brief with tokens for each UI task |
| `gs_compose_design_prompt` | implementing | YES (UI tasks) | Regenerate prompt with loaded tokens before writing UI code |
| `gs_compose_design_prompt` | reviewing | YES (UI tasks) | Run 5-dimension critique on UI output |
| `gs_detect_agents` | any | Recommended | Check available CLI agents for design generation |

## OpenCode Tool Mapping

Superpowers tools are mapped to OpenCode as follows:
- `TodoWrite` → `todowrite`
- `Task` with subagents → `@mention` system  
- `Read/Write/Edit` → Native OpenCode tools
- `Skill` → Native `skill` tool
- `Bash` → Native `bash` tool

## Error Recovery

If a GS MCP tool returns an error:
1. Read the error message carefully
2. It will tell you exactly what you did wrong
3. Correct your approach and retry
4. If the error says phase is incomplete, complete the current phase before proposing transition

## Prohibited Actions

- ❌ Reading/writing files without first calling `gs_check_file`
- ❌ Writing code during brainstorming or planning phases
- ❌ Committing without `gs_pre_commit`
- ❌ Skipping to implementation before design and plan are complete
- ❌ Claiming completion without running `gs_propose_transition`
- ❌ Using manual file search when GitNexus graph tools are available
- ❌ Writing UI code without first loading a design system via `gs_load_design_system`
- ❌ Using ad-hoc hex colors, fonts, or spacing instead of design system tokens
- ❌ Using "Lorem ipsum" or generic placeholder text in any design output
- ❌ Skipping `gs_compose_design_prompt` before generating UI code
- ❌ Using design system colors/fonts without loading the DESIGN.md first

## Success Pattern

The correct flow ALWAYS looks like:
```
gs_workflow_status → understand phase → load gs skill →
[DETECT: is this a UI/visual task? → load design system + compose design prompt] →
follow phase workflow → gs_record_output → gs_propose_transition →
user confirms in terminal → next phase begins
```
