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
4. Ask clarifying questions about requirements, constraints, edge cases
5. Propose architecture and design decisions
6. Validate each decision with the user
7. Write design document to .gs/design.md
8. Call gs_propose_transition with target: "planning"

DO NOT write any implementation code. Focus on WHAT and WHY, not HOW.`;

    case "planning":
      return `### Planning Instructions
You are in the PLANNING phase. Create a detailed implementation plan.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Review the design document at .gs/design.md
4. Use GitNexus impact tool to calculate blast radius for each change
5. Break work into tasks of 2-5 minutes each
6. For each task: exact file paths, test files, code structure, verification
7. Use GitNexus context to find existing patterns to follow
8. Write plan to .gs/plan.md
9. Call gs_propose_transition with target: "implementing"

Each task must include:
- Exact file paths to create/modify
- Test file and test cases
- Expected code structure
- Verification steps`;

    case "implementing":
      return `### Implementation Instructions
You are in the IMPLEMENTING phase. Execute the plan using TDD.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Load the plan from .gs/plan.md
4. For EACH task, follow strict TDD:
   a. Call gs_check_file BEFORE every file operation
   b. Write failing test first
   c. Run test, confirm it fails
   d. Write minimal implementation
   e. Run test, confirm it passes
   f. Refactor if needed
5. Call gs_pre_commit BEFORE every commit
6. After commit, GitNexus will be auto-refreshed
7. Mark tasks complete via gs_complete_task
8. When all tasks done, call gs_propose_transition with target: "reviewing"

CRITICAL: Never write code before its test. Never skip gs_check_file.`;

    case "reviewing":
      return `### Review Instructions
You are in the REVIEWING phase. Review all changes thoroughly.

MANDATORY STEPS:
1. Call gs_workflow_status to confirm phase
2. Load the 'gs' skill via the skill tool
3. Use GitNexus detect_changes to see all modified code
4. Use GitNexus impact to verify blast radius of changes
5. Review each changed file against the plan
6. Verify all tests pass
7. Check for:
   - Missing tests
   - Performance issues
   - Security vulnerabilities
   - Breaking changes
8. Report issues by severity (critical blocks merge)
9. Call gs_propose_transition with target: "finishing"`;

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

## Core Rule
This project uses GS Runtime (Superpowers + GitNexus bridge).
You MUST follow the enforced workflow. No exceptions.

## Mandatory Actions (in order)
1. ALWAYS call \`gs_workflow_status\` first - it tells you the current phase
2. ALWAYS load the 'gs' skill using the skill tool
3. ALWAYS call \`gs_check_file\` before ANY file operation
4. ALWAYS call \`gs_pre_commit\` before ANY git commit
5. ALWAYS call \`gs_propose_transition\` before moving to next phase

## Phase Summary
- **brainstorming**: Explore ideas, design architecture, validate requirements
- **planning**: Create detailed implementation plan with exact file paths
- **implementing**: Execute plan with TDD (RED-GREEN-REFACTOR)
- **reviewing**: Code review with GitNexus impact analysis
- **finishing**: Final checks, cleanup, merge preparation

## GitNexus Integration
- Prefer GitNexus graph tools (query, context, impact, detect_changes) over manual search
- Fall back to file reads and rg when GitNexus is unavailable
- Check index freshness regularly

## Prohibited
- DO NOT skip phases
- DO NOT write code before tests (TDD is mandatory)
- DO NOT modify files without calling gs_check_file first
- DO NOT commit without running gs_pre_commit
- DO NOT claim completion without verification

## Workflow State
The GS CLI enforces the workflow. If you receive an error from an MCP tool,
it means you are not following the correct phase. Go back and follow the phase.
`;
}
