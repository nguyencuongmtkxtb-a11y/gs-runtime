import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { GSState, Phase, PhaseState, PhaseStatus } from "./types.js";
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

export function saveState(state: GSState, projectRoot?: string): void {
  const stateDir = getStateDir(projectRoot);
  ensureDir(stateDir);
  ensureDir(getGlobalDir());

  state.meta.updatedAt = new Date().toISOString();
  writeFileSync(getStatePath(projectRoot), JSON.stringify(state, null, 2), "utf-8");

  const globalStatePath = join(getGlobalDir(), `project-${sanitizeProjectName(state.project)}.json`);
  writeFileSync(globalStatePath, JSON.stringify(state, null, 2), "utf-8");
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

  if (markCurrentComplete || isBackward) {
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
