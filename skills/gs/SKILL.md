---
name: gs
description: ALWAYS load this skill FIRST in ANY GS-managed project. Unified Superpowers + GitNexus workflow: brainstorm → plan → implement → review → finish. MANDATORY - NO EXCEPTIONS.
---

# GS - Superpowers + GitNexus Unified Workflow

You are working in a project managed by GS Runtime. GS enforces a strict workflow that combines Superpowers methodology with GitNexus graph intelligence.

## CORE RULE

**Every action you take MUST be within the current workflow phase. You cannot skip phases, write code during brainstorming, or commit during planning.** The MCP server validates every operation.

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
4. Propose architecture and design decisions
5. Validate each decision with the user
6. Write design document to `.gs/design.md`
7. Call `gs_record_output` with the design document path
8. Call `gs_propose_transition` with target "planning"

**During brainstorming, you are ONLY allowed to READ files. Do NOT write code.**

### If phase is "planning":
1. Read the design document at `.gs/design.md`
2. Use GitNexus `impact` to calculate blast radius for each component that will change
3. Use GitNexus `context` to find all callers/callees of affected symbols
4. Break work into tasks of 2-5 minutes each
5. For each task, specify:
   - Exact file paths to create/modify
   - Test file and test cases
   - Expected code structure (follow existing patterns)
   - Verification steps
6. Write plan to `.gs/plan.md`
7. Register tasks via GS MCP (if available) or write to state
8. Call `gs_record_output` with the plan document path
9. Call `gs_propose_transition` with target "implementing"

**During planning, you are ONLY allowed to READ files. Do NOT write code.**

### If phase is "implementing":
1. Read the plan from `.gs/plan.md`
2. For EACH task, follow strict TDD (Test-Driven Development):
   ```
   RED:   Call gs_check_file BEFORE writing test file
          Write the failing test
          Run test → confirm it FAILS
   GREEN: Write minimal implementation code
          Run test → confirm it PASSES
   REFACTOR: Clean up code while keeping tests green
   ```
3. Before EACH file operation, call `gs_check_file` with the file path
4. Before EACH commit, call `gs_pre_commit`
5. After commit, GitNexus index will be refreshed (if hooks installed)
6. Call `gs_complete_task` after each task is done
7. When all tasks done, call `gs_record_output`
8. Call `gs_propose_transition` with target "reviewing"

**CRITICAL: NEVER write code before its test. NEVER skip gs_check_file.**
**CRITICAL: If a test is deleted because code was written first, start over.**

### If phase is "reviewing":
1. Use GitNexus `detect_changes` to see all modified code
2. Use GitNexus `impact` to verify blast radius of changes
3. Review each changed file against the plan
4. Verify all tests pass
5. Check for security, performance, and code quality issues
6. Report issues by severity (critical blocks merge)
7. Call `gs_record_output` with review summary
8. Call `gs_propose_transition` with target "finishing"

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

## Success Pattern

The correct flow ALWAYS looks like:
```
gs_workflow_status → understand phase → load gs skill → 
follow phase workflow → gs_record_output → gs_propose_transition →
user confirms in terminal → next phase begins
```
