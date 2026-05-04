import type { GSState, Phase } from "../shared/types.js";
import { PHASE_LABELS, PHASE_DESCRIPTIONS } from "../shared/types.js";

export function buildPhaseContext(state: GSState): string {
  const phase = state.currentPhase;
  const phaseLabel = PHASE_LABELS[phase];
  const gitnexusStatus = state.gitnexus.indexed
    ? state.gitnexus.stale
      ? "INDEXED (STALE - reindex recommended)"
      : "INDEXED"
    : "NOT INDEXED";

  const baseInstructions = getPhaseInstructions(phase);

  return `## GS WORKFLOW CONTEXT (AUTO-INJECTED)

### Current Phase: ${phaseLabel}
${PHASE_DESCRIPTIONS[phase]}

### Workflow State
- Current phase: ${phaseLabel} (${phase})
- Phase status: ${state.phases[phase].status}
- Workflow count: ${state.meta.workflowCount}
- GitNexus: ${gitnexusStatus}

${baseInstructions}
`;
}

function getPhaseInstructions(phase: Phase): string {
  switch (phase) {
    case "brainstorming":
      return `### Brainstorming Instructions
You are in the BRAINSTORMING phase. Your task is to explore the user's idea thoroughly.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Use GitNexus query/context to understand existing codebase patterns
4. DETECT: Is this a UI/visual task? If YES:
   a. Call gs_list_design_skills to find relevant design skills
   b. Call gs_search_design_systems with keyword to find matching design system
   c. Call gs_compose_design_prompt in discovery mode
5. Ask clarifying questions about requirements, constraints, edge cases
6. Propose architecture and design decisions (include design system choice)
7. Validate each decision with the user
8. Write design document to .gs/design.md
9. Call gs_propose_transition with target: "planning"

DO NOT write any implementation code. Focus on WHAT and WHY, not HOW.`;

    case "planning":
      return `### Planning Instructions
You are in the PLANNING phase. Create a detailed implementation plan.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Review the design document at .gs/design.md
4. DETECT: Does plan include UI tasks? If YES:
   a. Call gs_load_design_system with the name from design doc
   b. Call gs_compose_design_prompt with skill + system
   c. All UI tasks MUST reference loaded design tokens
5. Use GitNexus impact tool to calculate blast radius for each change
6. Break work into tasks of 2-5 minutes each
7. For each task: exact file paths, test files, code structure, verification
8. Use GitNexus context to find existing patterns to follow
9. Write plan to .gs/plan.md
10. Call gs_propose_transition with target: "implementing"

Each task must include:
- Exact file paths to create/modify
- Test file and test cases
- Expected code structure
- Design tokens reference (colors, fonts, spacing from design system)
- Verification steps`;

    case "implementing":
      return `### Implementation Instructions
You are in the IMPLEMENTING phase. Execute the plan using TDD.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Load the plan from .gs/plan.md
4. DETECT: Are there UI tasks? BEFORE writing any CSS:
   a. Call gs_compose_design_prompt with skill + design system
   b. Keep design tokens visible — ZERO ad-hoc CSS
5. For EACH task, follow strict TDD:
   a. Call gs_check_file BEFORE every file operation
   b. Write failing test first
   c. Run test, confirm it fails
   d. Write minimal implementation
   e. Run test, confirm it passes
   f. Refactor if needed
6. Call gs_pre_commit BEFORE every commit
7. After commit, GitNexus will be auto-refreshed
8. Mark tasks complete via gs_complete_task
9. When all tasks done, call gs_propose_transition with target: "reviewing"

CRITICAL: Never write code before its test. Never skip gs_check_file.
CRITICAL: Never write CSS without first loading design system tokens.`;

    case "reviewing":
      return `### Review Instructions
You are in the REVIEWING phase. Review all changes thoroughly.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Use GitNexus detect_changes to see all modified code
4. Use GitNexus impact to verify blast radius of changes
5. Review each changed file against the plan
6. DETECT: Were there UI changes? If YES:
   a. Call gs_compose_design_prompt in critique mode
   b. Verify all colors/fonts/spacing match loaded design system
   c. Flag ad-hoc values as HIGH severity violations
7. Verify all tests pass
8. Check for:
   - Missing tests
   - Performance issues
   - Security vulnerabilities
   - Breaking changes
   - Design token violations
9. Report issues by severity (critical blocks merge)
10. Call gs_propose_transition with target: "finishing"`;

    case "finishing":
      return `### Finishing Instructions
You are in the FINISHING phase. Final verification and cleanup.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Run full test suite
4. Use GitNexus detect_changes for final impact check
5. Clean up temporary files
6. Verify documentation is updated
7. Present merge/PR options to user
8. Call gs_propose_transition with target: "completed"`;

    default:
      return `### Instructions
Current phase: ${phase}. Call gs_workflow_status for details.`;
  }
}

export function buildOpenCodeConfig(): {
  mcp: Record<string, { type: string; command: string[] }>;
} {
  return {
    mcp: {
      gs: {
        type: "local",
        command: ["gs", "mcp-start"],
      },
    },
  };
}

export function buildAgentsMd(): string {
  return `# GS Rules - MANDATORY

This project uses GS Runtime which combines Superpowers workflow methodology with GitNexus codebase graph intelligence.

## Core Rule

**You MUST follow the enforced workflow. No exceptions. No shortcuts.**

## Mandatory Actions (performed in this EXACT order)

### 1. ALWAYS call \`gs_workflow_status\` FIRST
Before any other action, call the MCP tool \`gs_workflow_status\`. This tells you:
- What phase you are in
- What you are allowed to do
- What the next step is

### 2. ALWAYS load the \`gs\` skill SECOND
Use the skill tool to load the \`gs\` skill. It contains detailed instructions for each phase.

### 3. ALWAYS call \`gs_check_file\` BEFORE file operations
Before reading, writing, editing, or deleting ANY file, call \`gs_check_file\` with the file path and operation type. This ensures you are working on files that belong to the current phase.

### 4. ALWAYS call \`gs_pre_commit\` BEFORE git commits
Before any commit, call \`gs_pre_commit\` to validate:
- Tests are passing
- GitNexus impact analysis is clean
- The commit is appropriate for the current phase

### 5. ALWAYS call \`gs_propose_transition\` when phase work is done
When you have completed all work in a phase, call \`gs_propose_transition\` to suggest moving to the next phase. The user must confirm by running the next \`gs\` command in terminal.

## Phase Restrictions

| Phase | Allowed | Prohibited |
|-------|---------|------------|
| brainstorming | Read files, ask questions, create design | Write code, modify files |
| planning | Read files, analyze impact, create plan | Write code, modify files |
| implementing | Read/write planned files, write tests, commit | Modify unplanned files |
| reviewing | Read all files, run tests, analyze | Modify files (fix only critical bugs) |
| finishing | Verify, clean up | New feature code |

## GitNexus Integration

When GitNexus is available (check \`gs_workflow_status\` output), use these tools instead of manual search:
- \`query\` - Search by concept, find patterns
- \`context\` - Inspect symbol dependencies
- \`impact\` - Calculate blast radius
- \`detect_changes\` - See diff impact

Fall back to \`grep\` and file reads only when GitNexus is unavailable.

## GS MCP Tools Reference

| Tool | When | Required |
|------|------|----------|
| \`gs_workflow_status\` | Start of EVERY conversation | YES |
| \`gs_check_file\` | Before EVERY file operation | YES |
| \`gs_pre_commit\` | Before EVERY git commit | YES |
| \`gs_inject_context\` | Need codebase understanding | Recommended |
| \`gs_propose_transition\` | Phase work complete | YES |
| \`gs_complete_task\` | After each plan task | During implement |
| \`gs_record_output\` | Phase output created | YES |
| \`gs_list_design_skills\` | UI task — brainstorming phase | YES (UI) |
| \`gs_search_design_systems\` | UI task — brainstorming phase | YES (UI) |
| \`gs_load_design_system\` | UI task — planning phase | YES (UI) |
| \`gs_compose_design_prompt\` | UI task — all phases | YES (UI) |
| \`gs_detect_agents\` | Design task — any phase | Recommended |

## Prohibited Actions

- ❌ Any action before \`gs_workflow_status\`
- ❌ Any file operation without \`gs_check_file\`
- ❌ Commits without \`gs_pre_commit\`
- ❌ Writing code during brainstorming or planning
- ❌ Modifying unplanned files during implementation
- ❌ Skipping phases
- ❌ Claiming completion without \`gs_propose_transition\`
- ❌ Writing CSS/styling without first loading a design system via \`gs_load_design_system\`
- ❌ Using ad-hoc hex colors, font sizes, or spacing — design system tokens ONLY
- ❌ Using "Lorem ipsum" or generic placeholder copy in any design output
- ❌ Generating UI code without first calling \`gs_compose_design_prompt\`

## Open Design Integration — MANDATORY

This project integrates **Open Design** as a submodule at \`integrations/open-design/\`.

### MANDATORY Usage Rules

| Phase | Mandatory Action |
|-------|-----------------|
| brainstorming (UI tasks) | \`gs_list_design_skills\` → \`gs_search_design_systems\` → \`gs_compose_design_prompt\` (discovery) |
| planning (UI tasks) | \`gs_load_design_system\` → get all tokens → reference in every UI task |
| implementing (UI tasks) | \`gs_compose_design_prompt\` → use ONLY design system tokens — NO ad-hoc CSS |
| reviewing (UI tasks) | \`gs_compose_design_prompt\` (critique mode) → verify colors/fonts/spacing match |

### CRITICAL Design Rules (ZERO exceptions)
- **NEVER write a single line of CSS without first loading a design system**
- **NEVER use ad-hoc hex colors, font sizes, or spacing — ONLY design system tokens**
- **NEVER use "Lorem ipsum" — all copy must be real and contextual**
- **All design output is verified against the loaded DESIGN.md in the review phase**

### MCP Design Tools

| Tool | Purpose |
|------|---------|
| \`gs_list_design_skills\` | List all 59 skills grouped by scenario |
| \`gs_load_design_system\` | Load a DESIGN.md by name |
| \`gs_search_design_systems\` | Search design systems by keyword |
| \`gs_detect_agents\` | Detect available CLI agents on PATH |
| \`gs_compose_design_prompt\` | Compose design prompt with system + skill |

## Violation Consequences

If you violate any rule, the MCP server will reject your operation. If you continue to violate rules, the CLI will reject phase transitions. Always follow the workflow.
`;
}
