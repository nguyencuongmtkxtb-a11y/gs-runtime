# GS Rules - MANDATORY

This project uses **GS Runtime** which combines Superpowers workflow methodology with GitNexus codebase graph intelligence.

## Core Rule

**You MUST follow the enforced workflow. No exceptions. No shortcuts.**

## Mandatory Actions (performed in this EXACT order)

### 1. ALWAYS call `gs_workflow_status` FIRST
Before any other action, call the MCP tool `gs_workflow_status`. This tells you:
- What phase you are in
- What you are allowed to do
- What the next step is

### 2. ALWAYS load the `gs` skill SECOND
Use the skill tool to load the `gs` skill. It contains detailed instructions for each phase.

### 3. ALWAYS call `gs_check_file` BEFORE file operations
Before reading, writing, editing, or deleting ANY file, call `gs_check_file` with the file path and operation type. This ensures you are working on files that belong to the current phase.

### 4. ALWAYS call `gs_pre_commit` BEFORE git commits
Before any commit, call `gs_pre_commit` to validate:
- Tests are passing
- GitNexus impact analysis is clean
- The commit is appropriate for the current phase

### 5. ALWAYS call `gs_propose_transition` when phase work is done
When you have completed all work in a phase, call `gs_propose_transition` to suggest moving to the next phase. The user must confirm by running the next `gs` command in terminal.

## Phase Restrictions

| Phase | Allowed | Prohibited |
|-------|---------|------------|
| brainstorming | Read files, ask questions, create design | Write code, modify files |
| planning | Read files, analyze impact, create plan | Write code, modify files |
| implementing | Read/write planned files, write tests, commit | Modify unplanned files |
| reviewing | Read all files, run tests, analyze | Modify files (fix only critical bugs) |
| finishing | Verify, clean up | New feature code |

## GitNexus Integration

When GitNexus is available (check `gs_workflow_status` output), use these tools instead of manual search:
- `query` - Search by concept, find patterns
- `context` - Inspect symbol dependencies
- `impact` - Calculate blast radius
- `detect_changes` - See diff impact

Fall back to `grep` and file reads only when GitNexus is unavailable.

## GS MCP Tools Reference

| Tool | When | Required |
|------|------|----------|
| `gs_workflow_status` | Start of EVERY conversation | YES |
| `gs_check_file` | Before EVERY file operation | YES |
| `gs_pre_commit` | Before EVERY git commit | YES |
| `gs_inject_context` | Need codebase understanding | Recommended |
| `gs_propose_transition` | Phase work complete | YES |
| `gs_complete_task` | After each plan task | During implement |
| `gs_record_output` | Phase output created | YES |

## Prohibited Actions

- ❌ Any action before `gs_workflow_status`
- ❌ Any file operation without `gs_check_file`
- ❌ Commits without `gs_pre_commit`
- ❌ Writing code during brainstorming or planning
- ❌ Modifying unplanned files during implementation
- ❌ Skipping phases
- ❌ Claiming completion without `gs_propose_transition`

## Violation Consequences

If you violate any rule, the MCP server will reject your operation. If you continue to violate rules, the CLI will reject phase transitions. Always follow the workflow.
