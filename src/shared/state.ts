import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import type { GSState, Phase, PhaseState, PhaseStatus, PlanTask } from "./types.js";
import { PHASE_ORDER, PHASE_LABELS } from "./types.js";

const STATE_DIR = ".gs";
const STATE_FILE = "state.json";
const GLOBAL_DIR = join(homedir(), ".gs");

export function getProjectRoot(): string {
  return process.cwd();
}

export function getStateDir(projectRoot?: string): string {
  return join(projectRoot ?? getProjectRoot(), STATE_DIR);
}

export function getStatePath(projectRoot?: string): string {
  return join(getStateDir(projectRoot), STATE_FILE);
}

export function getGlobalDir(): string {
  return GLOBAL_DIR;
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function createInitialState(projectName?: string): GSState {
  const now = new Date().toISOString();
  const phaseMap = {} as Record<Phase, PhaseState>;
  for (const phase of PHASE_ORDER) {
    phaseMap[phase] = {
      status: "pending",
      startedAt: null,
      completedAt: null,
      output: null,
      notes: [],
    };
  }
  phaseMap.idle.status = "completed";
  phaseMap.idle.startedAt = now;

  return {
    version: "1.0.0",
    project: projectName ?? "unknown",
    currentPhase: "idle",
    proposedPhase: null,
    workflowMode: "full",
    isUITask: false,
    phases: phaseMap,
    gitnexus: {
      indexed: false,
      lastIndexed: null,
      stale: false,
      repoPath: null,
    },
    plan: {
      tasks: [],
      createdAt: null,
    },
    meta: {
      createdAt: now,
      updatedAt: now,
      workflowCount: 1,
    },
  };
}

export function loadState(projectRoot?: string): GSState | null {
  const statePath = getStatePath(projectRoot);
  if (!existsSync(statePath)) return null;
  try {
    const raw = readFileSync(statePath, "utf-8");
    return JSON.parse(raw) as GSState;
  } catch {
    return null;
  }
}

/**
 * Atomic write: write to .tmp file then rename.
 * Prevents data corruption if process is killed mid-write or concurrent access occurs.
 */
function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = `${filePath}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmpPath, data, "utf-8");
  try {
    renameSync(tmpPath, filePath);
  } catch {
    // On Windows, rename can fail if target is locked. Fallback to direct write.
    writeFileSync(filePath, data, "utf-8");
    try { unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
  }
}

export function saveState(state: GSState, projectRoot?: string): void {
  const stateDir = getStateDir(projectRoot);
  ensureDir(stateDir);
  ensureDir(getGlobalDir());

  state.meta.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(state, null, 2);

  atomicWriteFileSync(getStatePath(projectRoot), serialized);

  const globalStatePath = join(getGlobalDir(), `project-${sanitizeProjectName(state.project)}.json`);
  atomicWriteFileSync(globalStatePath, serialized);
}

export function deleteState(projectRoot?: string): void {
  const statePath = getStatePath(projectRoot);
  const globalStatePath = join(getGlobalDir(), `project-${sanitizeProjectName(loadState(projectRoot)?.project ?? "unknown")}.json`);
  if (existsSync(statePath)) {
    unlinkSync(statePath);
  }
  if (existsSync(globalStatePath)) {
    unlinkSync(globalStatePath);
  }
}

function sanitizeProjectName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

export function canTransitionTo(
  currentPhase: Phase,
  targetPhase: Phase
): boolean {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const targetIndex = PHASE_ORDER.indexOf(targetPhase);
  if (targetIndex === -1) return false;
  if (targetPhase === "idle") return currentPhase === "completed";

  const backward: Record<Phase, Phase[]> = {
    idle: [],
    brainstorming: [],
    planning: ["brainstorming"],
    implementing: ["planning"],
    reviewing: ["implementing"],
    finishing: ["reviewing"],
    completed: [],
  };

  if (targetIndex === currentIndex + 1) return true;
  if (backward[currentPhase]?.includes(targetPhase)) return true;
  return false;
}

export function getNextPhase(currentPhase: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export function validatePhaseTransition(
  state: GSState,
  targetPhase: Phase
): { valid: boolean; reason: string } {
  if (!canTransitionTo(state.currentPhase, targetPhase)) {
    return {
      valid: false,
      reason: `Cannot transition from "${PHASE_LABELS[state.currentPhase]}" to "${PHASE_LABELS[targetPhase]}". Next valid phase is "${PHASE_LABELS[getNextPhase(state.currentPhase) ?? "completed"]}".`,
    };
  }

  const currentPhaseState = state.phases[state.currentPhase];
  if (currentPhaseState.status !== "completed") {
    return {
      valid: false,
      reason: `Current phase "${PHASE_LABELS[state.currentPhase]}" is not yet completed. Status: ${currentPhaseState.status}.`,
    };
  }

  return { valid: true, reason: "OK" };
}

export function transitionTo(
  state: GSState,
  targetPhase: Phase,
  markCurrentComplete: boolean = false
): { success: boolean; state: GSState; reason: string } {
  const isBackward = PHASE_ORDER.indexOf(targetPhase) < PHASE_ORDER.indexOf(state.currentPhase);
  
  if (!markCurrentComplete && !isBackward) {
    const validation = validatePhaseTransition(state, targetPhase);
    if (!validation.valid) {
      return { success: false, state, reason: validation.reason };
    }
  }

  if (!canTransitionTo(state.currentPhase, targetPhase)) {
    return { success: false, state, reason: "Invalid phase transition." };
  }

  if (markCurrentComplete) {
    state.phases[state.currentPhase].status = "completed";
    state.phases[state.currentPhase].completedAt = new Date().toISOString();
  }

  state.currentPhase = targetPhase;
  state.proposedPhase = null;
  state.phases[targetPhase].status = "in_progress";
  state.phases[targetPhase].startedAt = new Date().toISOString();

  return { success: true, state, reason: "OK" };
}

export function proposePhaseTransition(
  state: GSState,
  proposedPhase: Phase
): GSState {
  state.proposedPhase = proposedPhase;
  return state;
}

export function setPhaseOutput(
  state: GSState,
  phase: Phase,
  output: string
): GSState {
  state.phases[phase].output = output;
  return state;
}

export function completePhase(state: GSState, phase: Phase): GSState {
  state.phases[phase].status = "completed";
  state.phases[phase].completedAt = new Date().toISOString();
  return state;
}

export function addPhaseNote(
  state: GSState,
  phase: Phase,
  note: string
): GSState {
  state.phases[phase].notes.push(note);
  return state;
}

export function setPhaseStatus(
  state: GSState,
  phase: Phase,
  status: PhaseStatus
): GSState {
  state.phases[phase].status = status;
  return state;
}

/**
 * Parse plan tasks from markdown. Supports multiple heading formats:
 * - ### T1 — Task Name
 * - ### Task 1: Task Name
 * - ### Task 1 - Task Name
 * - ### 1. Task Name
 * - ### 1) Task Name
 * - ### Step 1 — Task Name
 */
export function parsePlanTasks(planContent: string): PlanTask[] {
  const tasks: PlanTask[] = [];
  const lines = planContent.split("\n");

  // Multiple patterns for task headings (ordered by specificity)
  const taskPatterns = [
    /^###\s+(T\d[\d.]*|Task\s+\d+|Step\s+\d+)\s*[—–:\-]\s*(.+)$/i,
    /^###\s+(\d+)\.\s+(.+)$/,
    /^###\s+(\d+)\)\s+(.+)$/,
    /^##\s+(T\d[\d.]*|Task\s+\d+|Step\s+\d+)\s*[—–:\-]\s*(.+)$/i,
    /^##\s+(\d+)\.\s+(.+)$/,
  ];

  let currentTask: Partial<PlanTask> | null = null;

  for (const line of lines) {
    let matched = false;
    for (const pattern of taskPatterns) {
      const match = line.match(pattern);
      if (match) {
        if (currentTask && currentTask.id) {
          finalizeTask(currentTask, tasks);
        }
        const rawId = match[1];
        const id = rawId.replace(/\./g, "_").replace(/\s+/g, "_").toLowerCase();
        currentTask = {
          id: id.startsWith("t") || id.startsWith("task") || id.startsWith("step") ? id : `t${id}`,
          description: `${rawId}: ${match[2].trim()}`,
          files: [],
          tests: [],
          status: "pending",
          priority: "medium",
          estimatedMinutes: 3,
        };
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (currentTask) {
      // File references: multiple formats
      const fileMatch = line.match(/^\s*-\s*\*\*Files?\*\*:\s*(.+)$/i) ||
                        line.match(/^\s*-\s*Files?:\s*(.+)$/i) ||
                        line.match(/^\s*-\s*`([^`]+\.\w+)`/);
      if (fileMatch) {
        const raw = fileMatch[1];
        const fileRefs = raw
          .split(/,|và|and|;/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const ref of fileRefs) {
          const cleaned = ref
            .replace(/[`*]/g, "")
            .replace(/\(create\)|\(edit\)|\(new\)|\(modify\)|\(create\s+dir\)|\(create\s+file\)/gi, "")
            .trim();
          if (cleaned && !cleaned.startsWith("•") && cleaned.length > 1 && cleaned.includes("/") || cleaned.includes(".")) {
            currentTask.files!.push(cleaned);
          }
        }
      }

      // Test references
      const testMatch = line.match(/^\s*-\s*\*\*Tests?\*\*:\s*(.+)$/i) ||
                        line.match(/^\s*-\s*Tests?:\s*(.+)$/i);
      if (testMatch) {
        const testFiles = testMatch[1]
          .split(/,|;/)
          .map((s) => s.trim().replace(/[`*]/g, ""))
          .filter(Boolean);
        currentTask.tests!.push(...testFiles);
      }

      const priorityMatch = line.match(/^\s*-\s*\*\*Priority\*\*:\s*(high|medium|low)/i) ||
                            line.match(/^\s*-\s*Priority:\s*(high|medium|low)/i);
      if (priorityMatch) {
        currentTask.priority = priorityMatch[1].toLowerCase() as "high" | "medium" | "low";
      }

      const estMatch = line.match(/^\s*-\s*\*\*(?:Est|Estimate|Time)\*\*:\s*(\d+)\s*min/i) ||
                       line.match(/^\s*-\s*(?:Est|Estimate|Time):\s*(\d+)\s*min/i);
      if (estMatch) {
        currentTask.estimatedMinutes = parseInt(estMatch[1], 10);
      }
    }
  }

  if (currentTask && currentTask.id) {
    finalizeTask(currentTask, tasks);
  }

  return tasks;
}

function finalizeTask(task: Partial<PlanTask>, output: PlanTask[]): void {
  if (!task.id) return;
  if (!task.files || task.files.length === 0) {
    task.files = [task.id];
  }
  output.push(task as PlanTask);
}
