import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

const TOOL_DEFINITIONS = [
  ...DESIGN_TOOL_DEFINITIONS,
  {
    name: "gs_workflow_status",
    description:
      "REQUIRED: Call this FIRST before any action. Returns the current workflow phase, status, and what you must do next. Failing to call this first will cause errors.",
    inputSchema: {
      type: "object" as const,
      properties: {},
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
      properties: {},
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
        output: { type: "string", description: "Description or file path of the output" },
      },
      required: ["output"],
    },
  },
];

function loadProjectState(): { state: GSState | null; error: string | null } {
  const state = loadState();
  if (!state) {
    return { state: null, error: "GS not initialized in this project. Run 'gs init' first." };
  }
  return { state, error: null };
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
    const { state, error } = loadProjectState();

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

          const session = loadSession(process.cwd());
          const status: MCPWorkflowStatus = {
            currentPhase: state.currentPhase,
            phaseStatus: state.phases[state.currentPhase].status,
            phases: state.phases,
            gitnexus: { indexed: state.gitnexus.indexed, stale: state.gitnexus.stale },
            instructions: PHASE_DESCRIPTIONS[state.currentPhase],
            resumeContext: session ? buildResumeContext(process.cwd()) : null,
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

          if (operation === "read") {
            const privacy = checkPrivacy(filePath);
            if (privacy.blocked) {
              return {
                content: [{ type: "text", text: `@@PRIVACY_PROMPT_START@@\n${buildPrivacyPrompt(privacy)}\n@@PRIVACY_PROMPT_END@@` }],
              };
            }
          }

          const scout = checkScout(process.cwd(), filePath);
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

          if (currentPhase === "brainstorming" && operation !== "read") {
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: filePath,
                phase: currentPhase,
                reason: "In brainstorming phase, only file reads are allowed. Do not write code yet.",
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          if (currentPhase === "planning" && operation !== "read") {
            return {
              content: [{ type: "text", text: JSON.stringify({
                allowed: false,
                path: filePath,
                phase: currentPhase,
                reason: "In planning phase, only file reads are allowed. Write the plan first, then move to implementation.",
                planTask: null,
              } as MCPFileCheckResult, null, 2) }],
            };
          }

          if (currentPhase === "implementing") {
            if (state.plan.tasks.length === 0) {
              return {
                content: [{ type: "text", text: JSON.stringify({
                  allowed: true,
                  path: filePath,
                  phase: currentPhase,
                  reason: "No plan tasks registered. Plan-based gate bypassed (plan.md is source of truth). Run 'gs implement --force' to clear this warning.",
                  planTask: null,
                } as MCPFileCheckResult, null, 2) }],
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
              const simplify = trackEditAndCheck(process.cwd());
              if (simplify.shouldRemind) {
                hookMessages.push(simplify.message);
              }

              const planCheck = validatePlanFormat(process.cwd(), filePath);
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

          const securityScan = scanStagedFiles(process.cwd());
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

          if (!state.gitnexus.indexed) {
            return {
              content: [{ type: "text", text: JSON.stringify({
                concept,
                gitnexus_available: false,
                instruction: "GitNexus is not indexed. Use file reads and grep to explore the codebase manually.",
                current_phase: PHASE_LABELS[state.currentPhase],
                phase_context: PHASE_DESCRIPTIONS[state.currentPhase],
              }, null, 2) }],
            };
          }

          return {
            content: [{ type: "text", text: JSON.stringify({
              concept,
              gitnexus_available: true,
              instruction: `Use GitNexus MCP tools: 'query' with query "${concept}" then 'context' on relevant symbols.`,
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
            const designPath = join(process.cwd(), ".gs", "design.md");
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

          const sm = new StateMachine();
          const result = sm.executeTransition(targetPhase);

          if (result.success) {
            if (targetPhase === "reviewing" || targetPhase === "implementing") {
              await sm.reindexGitNexus();
            }
            const existingSession = loadSession(process.cwd());
            if (existingSession) {
              updateSessionFromState(
                existingSession,
                sm.getState(),
                process.cwd(),
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
          saveState(state);
          const session = loadSession(process.cwd());
          if (session) {
            session.planTasks = state.plan.tasks.map((t) => ({ id: t.id, description: t.description, status: t.status }));
            session.completedTasks = state.plan.tasks.filter((t) => t.status === "completed").map((t) => t.id);
            session.lastAction = `task_complete:${taskId}`;
            session.lastActionTime = new Date().toISOString();
            saveSession(process.cwd(), session);
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

          const sm = new StateMachine();
          const prevPhase = sm.getCurrentPhase();
          const markResult = sm.markPhaseComplete(output);

          if (prevPhase === "planning") {
            const planPath = join(process.cwd(), ".gs", "plan.md");
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
          const nextLabel = nextPhase ? ` Next: call gs_propose_transition with target "${nextPhase}", then run 'gs ${nextPhase}' in terminal.` : "";

          const existingSession = loadSession(process.cwd());
          if (existingSession) {
            updateSessionFromState(
              existingSession,
              sm.getState(),
              process.cwd(),
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
