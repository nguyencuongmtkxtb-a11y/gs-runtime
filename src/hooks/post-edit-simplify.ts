import { loadSession, saveSession } from "../shared/session-state.js";

const SIMPLIFY_THRESHOLD = 5;
const COOLDOWN_MINUTES = 10;

export interface SimplifyReminderResult {
  shouldRemind: boolean;
  editCount: number;
  message: string;
}

export function trackEditAndCheck(root: string): SimplifyReminderResult {
  const session = loadSession(root);
  if (!session) return { shouldRemind: false, editCount: 0, message: "" };

  const editCount = (session.notes.filter((n) => n.startsWith("edit:")).length) + 1;
  session.notes.push(`edit:${new Date().toISOString()}`);
  session.lastAction = `edit #${editCount}`;
  session.lastActionTime = new Date().toISOString();
  saveSession(root, session);

  if (editCount < SIMPLIFY_THRESHOLD) {
    return { shouldRemind: false, editCount, message: "" };
  }

  const lastReminder = session.notes.find((n) => n.startsWith("simplify-reminder:"));
  if (lastReminder) {
    const lastTime = new Date(lastReminder.split(":")[1]).getTime();
    const elapsed = Date.now() - lastTime;
    if (elapsed < COOLDOWN_MINUTES * 60 * 1000) {
      return { shouldRemind: false, editCount, message: "(cooldown)" };
    }
  }

  session.notes.push(`simplify-reminder:${new Date().toISOString()}`);
  saveSession(root, session);

  return {
    shouldRemind: true,
    editCount,
    message: `You've made ${editCount} edits this session. Consider running the code-simplifier agent to reduce complexity, remove duplication, and improve readability. All existing tests must continue to pass.`,
  };
}

export function resetEditCounter(root: string): void {
  const session = loadSession(root);
  if (!session) return;
  session.notes = session.notes.filter((n) => !n.startsWith("edit:") && !n.startsWith("simplify-reminder:"));
  session.lastAction = "edit-counter-reset";
  session.lastActionTime = new Date().toISOString();
  saveSession(root, session);
}
