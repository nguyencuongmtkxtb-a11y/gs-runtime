import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { GSState, PlanTask } from "./types.js";

const SESSION_DIR = ".gs/session";
const LATEST = "latest.md";
const ARCHIVE_DIR = "archive";
const MAX_ARCHIVE = 5;

export interface SessionState {
  project: string;
  branch: string;
  phase: string;
  planTasks: { id: string; description: string; status: string }[];
  completedTasks: string[];
  modifiedFiles: string[];
  lastAction: string;
  lastActionTime: string;
  subagentResults: { agent: string; result: string; time: string }[];
  notes: string[];
  resumeContext: string;
}

function getSessionDir(root: string): string {
  return join(root, SESSION_DIR);
}

function getLatestPath(root: string): string {
  return join(getSessionDir(root), LATEST);
}

function getArchiveDir(root: string): string {
  return join(getSessionDir(root), ARCHIVE_DIR);
}

export function ensureSessionDir(root: string): void {
  const dir = getSessionDir(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const archive = getArchiveDir(root);
  if (!existsSync(archive)) mkdirSync(archive, { recursive: true });
}

export function createInitialSession(project: string): SessionState {
  return {
    project,
    branch: "unknown",
    phase: "idle",
    planTasks: [],
    completedTasks: [],
    modifiedFiles: [],
    lastAction: "gs init",
    lastActionTime: new Date().toISOString(),
    subagentResults: [],
    notes: [],
    resumeContext: "",
  };
}

export function loadSession(root: string): SessionState | null {
  const path = getLatestPath(root);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const sections = raw.split("\n---\n");
    const metaSection = sections.find((s) => s.startsWith("## Meta"));
    if (!metaSection) return null;
    const meta: Record<string, string> = {};
    for (const line of metaSection.split("\n")) {
      const m = line.match(/^- \*\*(\w+)\*\*: (.+)$/);
      if (m) meta[m[1]] = m[2];
    }
    return JSON.parse(meta.data ?? "{}") as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(root: string, session: SessionState): void {
  ensureSessionDir(root);
  const path = getLatestPath(root);

  const tasksDone = session.completedTasks.length;
  const tasksLeft = session.planTasks.filter((t) => t.status !== "completed").length;
  const modifiedList = session.modifiedFiles.length > 0
    ? session.modifiedFiles.map((f) => `- ${f}`).join("\n")
    : "- (none)";

  const subagentSection = session.subagentResults.length > 0
    ? session.subagentResults.map((s) => `- **${s.agent}** (${s.time}): ${s.result}`).join("\n")
    : "- (none)";

  const content = `# Session State — ${session.project}

## Summary
- **Phase**: ${session.phase}
- **Branch**: ${session.branch}
- **Last Action**: ${session.lastAction}
- **Last Action Time**: ${session.lastActionTime}
- **Tasks Completed**: ${tasksDone}
- **Tasks Remaining**: ${tasksLeft}

## Plan Tasks
${session.planTasks.map((t) => `- [${t.status === "completed" ? "x" : " "}] ${t.id}: ${t.description}`).join("\n") || "- (no tasks)"}

## Modified Files
${modifiedList}

## Subagent Results
${subagentSection}

## Resume Context
${session.resumeContext || "Resume from where you left off. Re-read plan files and todo list. Do NOT re-do completed work."}

---
## Meta
- **project**: ${session.project}
- **phase**: ${session.phase}
- **data**: ${JSON.stringify(session)}
`;

  if (existsSync(path)) {
    archiveSession(root);
  }

  writeFileSync(path, content, "utf-8");
}

function archiveSession(root: string): void {
  const archiveDir = getArchiveDir(root);
  ensureSessionDir(root);
  const existing = readdirSync(archiveDir).filter((f) => f.endsWith(".md")).length;
  if (existing >= MAX_ARCHIVE) {
    const files = readdirSync(archiveDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (let i = 0; i <= files.length - MAX_ARCHIVE; i++) {
      unlinkSync(join(archiveDir, files[i]));
    }
  }

  const latest = getLatestPath(root);
  if (existsSync(latest)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    renameSync(latest, join(archiveDir, `session-${timestamp}.md`));
  }
}

export function buildResumeContext(root: string): string {
  const session = loadSession(root);
  if (!session) return "";

  return `## SESSION RECOVERY (AUTO-INJECTED)

You are resuming a previous session. Here is what was happening:

### Previous Session State
- **Project**: ${session.project}
- **Phase**: ${session.phase}
- **Completed Tasks**: ${session.completedTasks.length > 0 ? session.completedTasks.join(", ") : "none"}
- **Remaining Tasks**: ${session.planTasks.filter((t) => t.status !== "completed").map((t) => t.id).join(", ") || "none"}
- **Modified Files**: ${session.modifiedFiles.length > 0 ? session.modifiedFiles.join(", ") : "none"}
- **Last Action**: ${session.lastAction}
- **Last Action Time**: ${session.lastActionTime}

### CRITICAL Instructions
- Re-read the plan file (.gs/plan.md) and any open design documents
- Do NOT re-do tasks already marked as completed
- Pick up from the next pending task
- If no pending tasks and phase is "implementing", verify all tests pass and propose transition to "reviewing"

### Subagent Results
${session.subagentResults.map((s) => `- ${s.agent}: ${s.result}`).join("\n") || "- none"}

### Session Notes
${session.notes.map((n) => `- ${n}`).join("\n") || "- none"}
`;
}

export function updateSessionFromState(
  session: SessionState,
  state: GSState,
  root: string,
  action: string,
  modifiedFiles?: string[]
): SessionState {
  session.phase = state.currentPhase;
  session.planTasks = state.plan.tasks.map((t) => ({
    id: t.id,
    description: t.description,
    status: t.status,
  }));
  session.completedTasks = state.plan.tasks
    .filter((t) => t.status === "completed")
    .map((t) => t.id);
  session.lastAction = action;
  session.lastActionTime = new Date().toISOString();

  if (modifiedFiles) {
    for (const f of modifiedFiles) {
      if (!session.modifiedFiles.includes(f)) {
        session.modifiedFiles.push(f);
      }
    }
  }

  saveSession(root, session);
  return session;
}

export function addSubagentResult(
  root: string,
  agent: string,
  result: string
): void {
  const session = loadSession(root);
  if (!session) return;
  session.subagentResults.push({
    agent,
    result,
    time: new Date().toISOString(),
  });
  session.lastAction = `subagent:${agent}`;
  session.lastActionTime = new Date().toISOString();
  saveSession(root, session);
}

export function addSessionNote(root: string, note: string): void {
  const session = loadSession(root);
  if (!session) return;
  session.notes.push(note);
  saveSession(root, session);
}
