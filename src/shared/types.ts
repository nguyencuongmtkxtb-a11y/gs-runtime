export type Phase =
  | "idle"
  | "brainstorming"
  | "planning"
  | "implementing"
  | "reviewing"
  | "finishing"
  | "completed";

export type PhaseStatus = "pending" | "in_progress" | "completed" | "blocked";

/** Workflow mode determines enforcement level */
export type WorkflowMode = "full" | "quick";

/** Whether Open Design enforcement is active for this workflow */
export type UITaskMode = boolean;

export const PHASE_ORDER: Phase[] = [
  "idle",
  "brainstorming",
  "planning",
  "implementing",
  "reviewing",
  "finishing",
  "completed",
];

export const PHASE_LABELS: Record<Phase, string> = {
  idle: "Idle",
  brainstorming: "Brainstorming",
  planning: "Planning",
  implementing: "Implementing",
  reviewing: "Reviewing",
  finishing: "Finishing",
  completed: "Completed",
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  idle: "No active workflow. Run 'gs brainstorm' to start.",
  brainstorming:
    "Exploring the feature: requirements, design, and architecture decisions.",
  planning: "Creating a detailed implementation plan with exact file paths and tasks.",
  implementing: "Executing the plan: TDD, subagent tasks, continuous review.",
  reviewing: "Code review with graph-based impact analysis.",
  finishing: "Final verification, cleanup, and merge preparation.",
  completed: "Workflow complete. Ready to merge or deploy.",
};

export interface PhaseState {
  status: PhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  output: string | null;
  notes: string[];
}

export interface GSState {
  version: string;
  project: string;
  currentPhase: Phase;
  proposedPhase: Phase | null;
  workflowMode: WorkflowMode;
  isUITask: UITaskMode;
  phases: Record<Phase, PhaseState>;
  gitnexus: {
    indexed: boolean;
    lastIndexed: string | null;
    stale: boolean;
    repoPath: string | null;
  };
  plan: {
    tasks: PlanTask[];
    createdAt: string | null;
  };
  meta: {
    createdAt: string;
    updatedAt: string;
    workflowCount: number;
  };
}

export interface PlanTask {
  id: string;
  description: string;
  files: string[];
  tests: string[];
  status: PhaseStatus;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface GitNexusContext {
  query: string;
  results: GitNexusQueryResult | null;
  indexed: boolean;
  error: string | null;
}

export interface GitNexusQueryResult {
  processes: Array<{
    summary: string;
    priority: number;
    symbol_count: number;
    process_type: string;
    step_count: number;
  }>;
  definitions: Array<{
    name: string;
    type: string;
    filePath: string;
  }>;
}

export interface MCPWorkflowStatus {
  currentPhase: Phase;
  phaseStatus: PhaseStatus;
  phases: Record<Phase, PhaseState>;
  gitnexus: { indexed: boolean; stale: boolean };
  instructions: string;
  resumeContext: string | null;
}

export interface MCPFileCheckResult {
  allowed: boolean;
  path: string;
  phase: Phase;
  reason: string;
  planTask: PlanTask | null;
}

export interface MCPPreCommitResult {
  ready: boolean;
  issues: string[];
  gitnexusImpact: unknown | null;
  testsStatus: "pass" | "fail" | "unknown";
  security: {
    scanned: boolean;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    summary: string;
  } | null;
}
