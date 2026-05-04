import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadState, saveState, getNextPhase, parsePlanTasks } from "../shared/state.js";
import { checkIndex } from "../gitnexus/bridge.js";
import { StateMachine } from "../cli/state-machine.js";
import { loadSession, saveSession, updateSessionFromState, buildResumeContext } from "../shared/session-state.js";
import { checkPrivacy, buildPrivacyPrompt } from "../hooks/privacy-block.js";
import { checkScout } from "../hooks/scout-block.js";
import { trackEditAndCheck } from "../hooks/post-edit-simplify.js";
import { validatePlanFormat } from "../hooks/plan-format-validator.js";
import { scanStagedFiles } from "../hooks/security-scan.js";
import type { GSState, Phase, MCPWorkflowStatus, MCPFileCheckResult, MCPPreCommitResult, PlanTask } from "../shared/types.js";
import { PHASE_LABELS, PHASE_DESCRIPTIONS } from "../shared/types.js";
import { DESIGN_TOOL_DEFINITIONS, handleDesignTool } from "./design-tools.js";

// Helper: resolve project root from args (supports cross-project)
function resolveProjectRoot(args: Record<string, unknown> | undefined | null): string {
  const projectPath = args?.project_path as string | undefined;
  if (projectPath) {
    const resolved = resolve(projectPath);
    if (existsSync(resolved)) return resolved;
  }
  return process.cwd();
}

// Common optional parameter for cross-project support
const PROJECT_PATH_PARAM = {
  project_path: {
    type: "string",
    description: "Optional: absolute path to the target project. If omitted, uses the current working directory. Use this when working with a project outside the workspace root.",
  },
};

const TOOL_DEFINITIONS = [
  ...DESIGN_TOOL_DEFINITIONS,
  {
    name: "gs_workflow_status",
    description:
      "REQUIRED: Call this FIRST before any action. Returns the current workflow phase, status, and what you must do next. Failing to call this first will cause errors.",
    inputSchema: {
      type: "object" as const,
      properties: { ...PROJECT_PATH_PARAM },
      required: [],
    },
  },
  {
    name: "gs_check_file",
    description:
      "REQUIRED: Call this BEFORE any file read/write/edit operation. Validates that the file operation is allowed in the current phase. Returns allowed/denied with reason.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        path: { type: "string", description: "The file path you want to operate on" },
        operation: {
          type: "string",
          enum: ["read", "write", "edit", "delete"],
          description: "The operation you want to perform",
        },
      },
      required: ["path", "operation"],
    },
  },
  {
    name: "gs_pre_commit",
    description:
      "REQUIRED: Call this BEFORE every git commit. Runs pre-commit checks: tests, GitNexus impact analysis. Returns whether commit is safe to proceed.",
    inputSchema: {
      type: "object" as const,
      properties: { ...PROJECT_PATH_PARAM },
      required: [],
    },
  },
  {
    name: "gs_inject_context",
    description:
      "Returns GitNexus graph context for the current task. Use this to understand codebase dependencies before making changes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        concept: { type: "string", description: "The concept, feature area, or symbol to get context about" },
      },
      required: ["concept"],
    },
  },
  {
    name: "gs_propose_transition",
    description:
      "Propose moving to the next workflow phase. The transition will be validated: current phase must be complete and the target must be the next valid phase.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        target_phase: {
          type: "string",
          description: "The phase to transition to (e.g., 'planning', 'implementing', 'reviewing', 'finishing')",
        },
      },
      required: ["target_phase"],
    },
  },
  {
    name: "gs_complete_task",
    description: "Mark a plan task as completed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        task_id: { type: "string", description: "The ID of the task to mark complete" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "gs_record_output",
    description: "Record output for the current phase (e.g., file path to design doc or plan).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        output: { type: "string", description: "Description or file path of the output" },
      },
      required: ["output"],
    },
  },
  {
    name: "gs_blast_radius",
    description: "Calculate blast radius for a file: which files import it (directly and transitively). Uses TypeScript import resolution — more accurate than GitNexus for cross-file dependencies.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        file: { type: "string", description: "Relative file path to analyze (e.g., 'src/shared/state.ts')" },
        maxDepth: { type: "number", description: "Max traversal depth (default: 3)" },
      },
      required: ["file"],
    },
  },
  {
    name: "gs_start_workflow",
    description: "Start a workflow from idle state. Call this when user describes a feature/fix and the project is in idle phase. Modes: 'full' (brainstorm→plan→implement→review→finish) or 'quick' (straight to implementing with relaxed rules).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        description: { type: "string", description: "Feature/fix description from the user" },
        mode: { type: "string", enum: ["full", "quick"], description: "Workflow mode: 'full' for complex features, 'quick' for bug fixes and small changes" },
        ui: { type: "boolean", description: "Whether this is a UI/design task (enables Open Design enforcement)" },
      },
      required: ["description", "mode"],
    },
  },
  {
    name: "gs_register_task",
    description: "Register a plan task explicitly (alternative to markdown parsing). Use during planning phase to register tasks that will be validated during implementation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ...PROJECT_PATH_PARAM,
        id: { type: "string", description: "Task ID (e.g., 't1', 'auth-setup')" },
        description: { type: "string", description: "Task description" },
        files: {
          type: "array",
          items: { type: "string" },
          description: "File paths this task will create or modify",
        },
        tests: {
          type: "array",
          items: { type: "string" },
          description: "Test file paths for this task",
        },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Task priority" },
        estimatedMinutes: { type: "number", description: "Estimated time in minutes" },
      },
      required: ["id", "description", "files"],
    },
  },
];

function loadProjectState(projectRoot?: string): { state: GSState | null; error: string | null; projectRoot: string } {
  const root = projectRoot ?? process.cwd();
  const state = loadState(root);
  if (!state) {
    return { state: null, error: `GS not initialized in "${root}". Run 'gs init' first.`, projectRoot: root };
  }
  return { state, error: null, projectRoot: root };
}

export async function startMCPServer(): Promise<void> {
  const server = new Server(
    { name: "gs-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const projectRoot = resolveProjectRoot(args as Record<string, unknown>);
    const { state, error } = loadProjectState(projectRoot);

    try {
      switch (name) {
        case "gs_workflow_status": {
          if (error || !state) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error,
                initialized: false,
                instructions: "GS not initialized. Run 'gs init' in your project first, then restart OpenCode.",
              }, null, 2) }],
            };
          }

          const session = loadSession(projectRoot);
          let phaseInstructions: string;
          if (state.currentPhase === "idle" || state.currentPhase === "completed") {
            phaseInstructions = "Ready to start. Call gs_start_workflow with the user's request description and mode ('full' for features, 'quick' for fixes/small changes).";
          } else if (state.workflowMode === "quick") {
            phaseInstructions = "Quick mode active. File writes unrestricted. Only gs_pre_commit enforced before commits. When done, call gs_propose_transition with target 'reviewing' or 'finishing'.";
          } else {
            phaseInstructions = PHASE_DESCRIPTIONS[state.currentPhase];
          }
          const quickModeInstructions = phaseInstructions;
          const status: MCPWorkflowStatus & { workflowMode: string } = {
            currentPhase: state.currentPhase,
            phaseStatus: state.phases[state.currentPhase].status,
            phases: state.phases,
            workflowMode: state.workflowMode ?? "full",
            gitnexus: { indexed: state.gitnexus.indexed, stale: state.gitnexus.stale },
            instructions: quickModeInstructions,
            resumeContext: session ? buildResumeContext(projectRoot) : null,
          };

          return {
            content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
          };
        }

        case "gs_check_file": {
          if (error || !state) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: String((args as Record<string, unknown>).path ?? ""),
                phase: "idle" as Phase,
                reason: "GS not initialized",
                planTask: null,
              } satisfies MCPFileCheckResult, null, 2) }],
            };
          }
          const currentPhase = state.currentPhase;
          const filePath = (args as Record<string, unknown>).path as string;
          const operation = (args as Record<string, unknown>).operation as string;

          // Read operations: only privacy hook blocks. No phase/scout gate.
          if (operation === "read") {
            const privacy = checkPrivacy(filePath);
            if (privacy.blocked) {
              return {
                content: [{ type: "text", text: `@@PRIVACY_PROMPT_START@@\n${buildPrivacyPrompt(privacy)}\n@@PRIVACY_PROMPT_END@@` }],
              };
            }
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: true,
                path: filePath,
                phase: currentPhase,
                reason: "Read operations are always allowed.",
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          // Write/edit/delete: scout block applies
          const scout = checkScout(projectRoot, filePath);
          if (scout.blocked) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: filePath,
                phase: currentPhase,
                reason: scout.reason,
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          // Brainstorming/planning: allow writes ONLY to .gs/ directory (design.md, plan.md)
          if (currentPhase === "brainstorming" && operation !== "read") {
            const normalizedPath = filePath.replace(/\\/g, "/");
            if (normalizedPath.includes(".gs/") || normalizedPath.startsWith(".gs")) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: true,
                  path: filePath,
                  phase: currentPhase,
                  reason: "Writing to .gs/ directory allowed during brainstorming (design doc).",
                  planTask: null,
                } as MCPFileCheckResult, null, 2) }],
              };
            }
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: filePath,
                phase: currentPhase,
                reason: "In brainstorming phase, only .gs/ writes allowed. Do not write code yet.",
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          if (currentPhase === "planning" && operation !== "read") {
            const normalizedPath = filePath.replace(/\\/g, "/");
            if (normalizedPath.includes(".gs/") || normalizedPath.startsWith(".gs")) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: true,
                  path: filePath,
                  phase: currentPhase,
                  reason: "Writing to .gs/ directory allowed during planning (plan doc).",
                  planTask: null,
                } as MCPFileCheckResult, null, 2) }],
              };
            }
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: filePath,
                phase: currentPhase,
                reason: "In planning phase, only .gs/ writes allowed. Create the plan, then transition to implementing.",
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          if (currentPhase === "implementing") {
            // Quick mode: allow all file writes without plan task gate
            if (state.workflowMode === "quick") {
              let hookMessages: string[] = [];
              if (operation === "write" || operation === "edit") {
                const simplify = trackEditAndCheck(projectRoot);
                if (simplify.shouldRemind) {
                  hookMessages.push(simplify.message);
                }
              }
              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: true,
                  path: filePath,
                  phase: currentPhase,
                  reason: "Quick mode — all file writes allowed. Only gs_pre_commit enforced.",
                  planTask: null,
                  hooks: hookMessages.length > 0 ? hookMessages : undefined,
                } as MCPFileCheckResult, null, 2) }],
              };
            }

            if (state.plan.tasks.length === 0) {
              // Check if plan.md exists — if it does, tasks should have been parsed
              const planPath = join(projectRoot, ".gs", "plan.md");
              const planExists = existsSync(planPath);
              const severity = planExists ? "warn" : "info";
              const reason = planExists
                ? `WARNING: plan.md exists but no tasks were parsed. Plan format may be incorrect (expected ### T1 — Task Name pattern). File access allowed but unguarded — review plan format.`
                : "No plan tasks registered and no plan.md found. File access allowed in degraded mode.";

              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: true,
                  path: filePath,
                  phase: currentPhase,
                  reason,
                  planTask: null,
                  severity,
                } as MCPFileCheckResult & { severity?: string }, null, 2) }],
              };
            }

            const matchingTask = state.plan.tasks.find(
              (t) => t.files.some((f) => filePath.includes(f.replace(/^\//, "")))
            );
            if (!matchingTask) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: false,
                  path: filePath,
                  phase: currentPhase,
                  reason: `File "${filePath}" is not in the implementation plan. Only planned files may be modified.`,
                  planTask: null,
                } as MCPFileCheckResult, null, 2) }],
              };
            }

            let hookMessages: string[] = [];
            if (operation === "write" || operation === "edit") {
              const simplify = trackEditAndCheck(projectRoot);
              if (simplify.shouldRemind) {
                hookMessages.push(simplify.message);
              }

              const planCheck = validatePlanFormat(projectRoot, filePath);
              if (!planCheck.valid || planCheck.issues.length > 0) {
                hookMessages.push(`Plan format issues: ${planCheck.issues.join("; ")}`);
              }
              if (planCheck.warnings.length > 0) {
                hookMessages.push(`Plan warnings: ${planCheck.warnings.join("; ")}`);
              }
            }

            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: true,
                path: filePath,
                phase: currentPhase,
                reason: `File is part of plan task: ${matchingTask.description}`,
                planTask: matchingTask,
                hooks: hookMessages.length > 0 ? hookMessages : undefined,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          return {
            content: [{ type: "text", text: JSON.stringify({
              allowed: true,
              path: filePath,
              phase: currentPhase,
              reason: "Operation allowed in current phase",
              planTask: null,
            } as MCPFileCheckResult, null, 2) }],
          };
        }

        case "gs_pre_commit": {
          if (error || !state) {
            return { content: [{ type: "text", text: JSON.stringify({
              ready: false,
              issues: ["GS not initialized"],
              gitnexusImpact: null,
              testsStatus: "unknown",
              security: null,
            } as MCPPreCommitResult, null, 2) }] };
          }

          if (state.currentPhase !== "implementing" && state.currentPhase !== "reviewing" && state.currentPhase !== "finishing") {
            return { content: [{ type: "text", text: JSON.stringify({
              ready: false,
              issues: [`Commits only allowed in implementing/reviewing/finishing phases. Current: ${PHASE_LABELS[state.currentPhase]}`],
              gitnexusImpact: null,
              testsStatus: "unknown",
              security: null,
            } as MCPPreCommitResult, null, 2) }] };
          }

          const securityScan = scanStagedFiles(projectRoot);
          const issues: string[] = [];
          if (!securityScan.passed) {
            for (const f of securityScan.findings.filter((f) => f.severity === "critical")) {
              issues.push(`[CRITICAL] ${f.file}:${f.line} — ${f.message}: ${f.snippet}`);
            }
          }
          for (const f of securityScan.findings.filter((f) => f.severity === "high")) {
            issues.push(`[HIGH] ${f.file}:${f.line} — ${f.message}`);
          }

          return { content: [{ type: "text", text: JSON.stringify({
            ready: securityScan.passed,
            issues,
            gitnexusImpact: null,
            testsStatus: "unknown",
            security: {
              scanned: true,
              totalFindings: securityScan.findings.length,
              critical: securityScan.findings.filter((f) => f.severity === "critical").length,
              high: securityScan.findings.filter((f) => f.severity === "high").length,
              medium: securityScan.findings.filter((f) => f.severity === "medium").length,
              summary: securityScan.summary,
            },
          } as MCPPreCommitResult, null, 2) }] };
        }

        case "gs_inject_context": {
          if (error || !state) {
            return { content: [{ type: "text", text: "GS not initialized." }] };
          }
          const concept = (args as Record<string, unknown>).concept as string;

          // Build import graph supplement for cross-file dependencies
          let importContext: unknown = null;
          try {
            const { buildDependencyMap } = await import("../gitnexus/import-resolver.js");
            const depMap = buildDependencyMap(projectRoot);
            // Find files related to the concept (simple keyword match on file paths)
            const conceptLower = concept.toLowerCase().replace(/[^a-z0-9]/g, "");
            const relatedFiles = Object.keys(depMap.importsFrom).filter((f) =>
              f.toLowerCase().replace(/[^a-z0-9/.]/g, "").includes(conceptLower)
            );

            if (relatedFiles.length > 0) {
              const fileDetails = relatedFiles.slice(0, 5).map((f) => ({
                file: f,
                imports: (depMap.importsFrom[f] ?? []).map((e) => ({ from: e.to, symbols: e.symbols })),
                importedBy: (depMap.importedBy[f] ?? []).map((e) => ({ by: e.from, symbols: e.symbols })),
              }));
              importContext = {
                totalEdges: depMap.edgeCount,
                relatedFiles: fileDetails,
              };
            }
          } catch {
            // Import resolver not available — continue without
          }

          return {
            content: [{ type: "text", text: JSON.stringify({
              concept,
              gitnexus_available: state.gitnexus.indexed,
              instruction: state.gitnexus.indexed
                ? `Use GitNexus MCP tools: 'query' with query "${concept}" then 'context' on relevant symbols. Note: GitNexus may miss cross-file import edges — use the importGraph below as supplement.`
                : "GitNexus not indexed. Use file reads and grep, plus importGraph below.",
              importGraph: importContext,
              current_phase: PHASE_LABELS[state.currentPhase],
              phase_context: PHASE_DESCRIPTIONS[state.currentPhase],
            }, null, 2) }],
          };
        }

        case "gs_propose_transition": {
          if (error || !state) {
            return { content: [{ type: "text", text: "GS not initialized." }] };
          }
          const targetPhase = (args as Record<string, unknown>).target_phase as Phase;

          if (state.currentPhase === "brainstorming" && targetPhase === "planning") {
            const designPath = join(projectRoot, ".gs", "design.md");
            if (!existsSync(designPath)) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  success: false,
                  message: "Cannot transition to planning. .gs/design.md is missing. Write the design document, then call gs_record_output first.",
                }, null, 2) }],
                isError: true,
              };
            }
            const content = readFileSync(designPath, "utf-8");
            if (content.trim().length < 50) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  success: false,
                  message: "Cannot transition to planning. .gs/design.md is too short. Fill in requirements, architecture, and design decisions first.",
                }, null, 2) }],
                isError: true,
              };
            }
          }

          const sm = new StateMachine(projectRoot);
          const result = sm.executeTransition(targetPhase);

          if (result.success) {
            if (targetPhase === "reviewing" || targetPhase === "implementing") {
              await sm.reindexGitNexus();
            }
            const existingSession = loadSession(projectRoot);
            if (existingSession) {
              updateSessionFromState(
                existingSession,
                sm.getState(),
                projectRoot,
                `gs_propose_transition:${targetPhase}`,
              );
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: !result.success,
          };
        }

        case "gs_complete_task": {
          if (error || !state) {
            return { content: [{ type: "text", text: "GS not initialized." }] };
          }
          const taskId = (args as Record<string, unknown>).task_id as string;
          const task = state.plan.tasks.find((t) => t.id === taskId);
          if (!task) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                success: false,
                message: `Task "${taskId}" not found in plan.`,
              }, null, 2) }],
            };
          }
          task.status = "completed";
          saveState(state, projectRoot);
          const session = loadSession(projectRoot);
          if (session) {
            session.planTasks = state.plan.tasks.map((t) => ({ id: t.id, description: t.description, status: t.status }));
            session.completedTasks = state.plan.tasks.filter((t) => t.status === "completed").map((t) => t.id);
            session.lastAction = `task_complete:${taskId}`;
            session.lastActionTime = new Date().toISOString();
            saveSession(projectRoot, session);
          }
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              task_id: taskId,
              message: `Task "${task.description}" marked as completed.`,
              remaining: state.plan.tasks.filter((t) => t.status !== "completed").length,
            }, null, 2) }],
          };
        }

        case "gs_record_output": {
          if (error || !state) {
            return { content: [{ type: "text", text: "GS not initialized." }] };
          }
          const output = (args as Record<string, unknown>).output as string;

          const sm = new StateMachine(projectRoot);
          const prevPhase = sm.getCurrentPhase();
          const markResult = sm.markPhaseComplete(output);

          if (prevPhase === "planning") {
            const planPath = join(projectRoot, ".gs", "plan.md");
            if (existsSync(planPath)) {
              const planContent = readFileSync(planPath, "utf-8");
              const extracted = parsePlanTasks(planContent);
              if (extracted.length > 0) {
                sm.clearPlanTasks();
                for (const task of extracted) {
                  sm.addPlanTask(task);
                }
              }
            }
          }

          const nextPhase = getNextPhase(prevPhase);
          const nextLabel = nextPhase ? ` Next: call gs_propose_transition with target "${nextPhase}" to continue.` : "";

          const existingSession = loadSession(projectRoot);
          if (existingSession) {
            updateSessionFromState(
              existingSession,
              sm.getState(),
              projectRoot,
              `gs_record_output:${prevPhase}`,
            );
          }

          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              completed_phase: prevPhase,
              message: `Phase "${prevPhase}" completed and output recorded.${nextLabel}`,
            }, null, 2) }],
          };
        }

        case "gs_blast_radius": {
          const blastArgs = args as Record<string, unknown>;
          const targetFile = blastArgs.file as string;
          const maxDepth = (blastArgs.maxDepth as number) ?? 3;

          try {
            const { calculateBlastRadius, getUpstreamDependents, getDownstreamDependencies, buildDependencyMap } = await import("../gitnexus/import-resolver.js");
            const depMap = buildDependencyMap(projectRoot);
            const upstream = getUpstreamDependents(projectRoot, targetFile, depMap);
            const downstream = getDownstreamDependencies(projectRoot, targetFile, depMap);
            const blastRadius = calculateBlastRadius(projectRoot, targetFile, maxDepth);

            const risk = blastRadius.length >= 10 ? "HIGH" : blastRadius.length >= 5 ? "MEDIUM" : "LOW";

            return {
              content: [{ type: "text", text: JSON.stringify({
                file: targetFile,
                risk,
                directImporters: upstream.map((e) => ({ file: e.from, symbols: e.symbols })),
                directDependencies: downstream.map((e) => ({ file: e.to, symbols: e.symbols })),
                blastRadius: blastRadius.map((r) => ({ depth: r.depth, file: r.file, symbols: r.symbols })),
                summary: `${upstream.length} direct importers, ${blastRadius.length} total affected files (depth ${maxDepth})`,
                totalProjectEdges: depMap.edgeCount,
              }, null, 2) }],
            };
          } catch (err) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                error: `Failed to calculate blast radius: ${err instanceof Error ? err.message : String(err)}`,
                file: targetFile,
              }, null, 2) }],
              isError: true,
            };
          }
        }

        case "gs_start_workflow": {
          if (error || !state) {
            return { content: [{ type: "text", text: `GS not initialized at "${projectRoot}". Run 'gs init' in that directory first.` }] };
          }
          if (state.currentPhase !== "idle" && state.currentPhase !== "completed") {
            return {
              content: [{ type: "text", text: JSON.stringify({
                success: false,
                message: `Workflow already active at phase "${PHASE_LABELS[state.currentPhase]}" in "${projectRoot}". Use gs_workflow_status to see current state, or ask user to run 'gs reset' to start over.`,
              }, null, 2) }],
            };
          }

          const workflowArgs = args as Record<string, unknown>;
          const description = workflowArgs.description as string;
          const mode = workflowArgs.mode as "full" | "quick";
          const isUI = (workflowArgs.ui as boolean) ?? false;

          const sm = new StateMachine(projectRoot);
          let result: { success: boolean; message: string };

          if (mode === "quick") {
            result = await sm.quick(description);
          } else {
            result = await sm.brainstorm(description, isUI);
          }

          if (!result.success) {
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              isError: true,
            };
          }

          const newState = sm.getState();
          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              mode,
              phase: newState.currentPhase,
              isUITask: newState.isUITask,
              message: mode === "quick"
                ? `Quick workflow started. You are now in implementing phase. Write code freely, call gs_pre_commit before commits.`
                : `Full workflow started. You are now in brainstorming phase. Explore requirements, write .gs/design.md, then call gs_record_output + gs_propose_transition to move to planning.`,
            }, null, 2) }],
          };
        }

        case "gs_register_task": {
          if (error || !state) {
            return { content: [{ type: "text", text: "GS not initialized." }] };
          }
          if (state.currentPhase !== "planning" && state.currentPhase !== "implementing") {
            return {
              content: [{ type: "text", text: JSON.stringify({
                success: false,
                message: `gs_register_task only allowed in planning or implementing phase. Current: ${PHASE_LABELS[state.currentPhase]}`,
              }, null, 2) }],
            };
          }
          const taskArgs = args as Record<string, unknown>;
          const newTask: PlanTask = {
            id: taskArgs.id as string,
            description: taskArgs.description as string,
            files: (taskArgs.files as string[]) ?? [],
            tests: (taskArgs.tests as string[]) ?? [],
            status: "pending",
            priority: (taskArgs.priority as "high" | "medium" | "low") ?? "medium",
            estimatedMinutes: (taskArgs.estimatedMinutes as number) ?? 5,
          };

          // Check for duplicate ID
          const existing = state.plan.tasks.find((t) => t.id === newTask.id);
          if (existing) {
            // Update existing task
            existing.description = newTask.description;
            existing.files = newTask.files;
            existing.tests = newTask.tests;
            existing.priority = newTask.priority;
            existing.estimatedMinutes = newTask.estimatedMinutes;
          } else {
            state.plan.tasks.push(newTask);
          }
          if (!state.plan.createdAt) {
            state.plan.createdAt = new Date().toISOString();
          }
          saveState(state, projectRoot);

          return {
            content: [{ type: "text", text: JSON.stringify({
              success: true,
              task_id: newTask.id,
              message: existing ? `Task "${newTask.id}" updated.` : `Task "${newTask.id}" registered.`,
              totalTasks: state.plan.tasks.length,
            }, null, 2) }],
          };
        }

        case "gs_list_design_skills":
        case "gs_load_design_system":
        case "gs_search_design_systems":
        case "gs_detect_agents":
        case "gs_compose_design_prompt": {
          const result = await handleDesignTool(name, (args ?? {}) as Record<string, unknown>);
          return {
            content: [{ type: "text", text: result }],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ error: errorMessage }, null, 2) }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    if (process.env.GS_DEBUG) {
      console.error("[gs-mcp] Server connected successfully");
    }
  } catch (err) {
    console.error("[gs-mcp] Failed to start:", err);
    process.exit(1);
  }
}
