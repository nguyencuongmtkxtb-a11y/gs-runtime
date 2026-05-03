import type { GSState, Phase, CommandResult, PlanTask } from "../shared/types.js";
import { PHASE_LABELS, PHASE_DESCRIPTIONS, PHASE_ORDER } from "../shared/types.js";
import {
  loadState,
  saveState,
  createInitialState,
  transitionTo,
  proposePhaseTransition,
  completePhase,
  setPhaseOutput,
  addPhaseNote,
  getNextPhase,
  deleteState,
  canTransitionTo as canTransition,
  validatePhaseTransition,
} from "../shared/state.js";
import { analyze as gitnexusAnalyze, checkIndex, isAvailable as isGitNexusAvailable } from "../gitnexus/bridge.js";
import { logger } from "../shared/logger.js";
import pc from "picocolors";

export class StateMachine {
  private state: GSState;
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot ?? process.cwd();
    const existing = loadState(this.projectRoot);
    if (existing) {
      this.state = existing;
    } else {
      const projectName = this.projectRoot.split(/[/\\]/).pop() ?? "unknown";
      this.state = createInitialState(projectName);
    }
  }

  getState(): GSState {
    return this.state;
  }

  getCurrentPhase(): Phase {
    return this.state.currentPhase;
  }

  persist(): void {
    saveState(this.state, this.projectRoot);
  }

  private checkPreviousPhaseComplete(targetPhase: Phase): boolean {
    const targetIdx = PHASE_ORDER.indexOf(targetPhase);
    const currentIdx = PHASE_ORDER.indexOf(this.state.currentPhase);
    if (targetIdx <= 1) return true;
    const prevPhase = PHASE_ORDER[targetIdx - 1];
    return this.state.phases[prevPhase].status === "completed";
  }

  async init(force: boolean = false): Promise<CommandResult> {
    if (this.state.phases[this.state.currentPhase]?.status === "in_progress" && !force) {
      return {
        success: false,
        message: `Workflow already in progress at "${PHASE_LABELS[this.state.currentPhase]}". Use 'gs status'. Use 'gs reset' first or 'gs init --force' to reset.`,
      };
    }

    logger.section("Initializing GS Runtime");
    logger.step("Project: " + this.state.project);
    logger.step("Root: " + this.projectRoot);
    this.persist();

    logger.divider();
    const gnAvailable = isGitNexusAvailable();
    if (gnAvailable) {
      logger.log("success", "GitNexus detected. Will index codebase.");
    } else {
      logger.log("warn", "GitNexus not found. Graph features disabled. Install: npm install -g gitnexus");
    }

    logger.log("info", "GS initialized.");
    logger.log("info", 'Next: gs brainstorm "your feature description"');
    return { success: true, message: "GS initialized successfully" };
  }

  async brainstorm(description: string): Promise<CommandResult> {
    const targetPhase: Phase = "brainstorming";

    if (this.state.currentPhase === "brainstorming") {
      logger.log("warn", "Brainstorming already active. Continuing...");
    } else if (this.state.currentPhase === "idle") {
      const result = transitionTo(this.state, targetPhase, true);
      if (!result.success) {
        return { success: false, message: result.reason };
      }
      this.state = result.state;
    } else {
      return {
        success: false,
        message: `Cannot start brainstorming. Current phase: ${PHASE_LABELS[this.state.currentPhase]}. Run 'gs reset' to start over.`,
      };
    }

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(description);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);
    await this.ensureGitNexusIndex();

    logger.divider();
    logger.code("OpenCode will load 'gs' skill → brainstorm workflow");
    logger.code("Output required: .gs/design.md");
    logger.code("MCP: gs_record_output → gs_propose_transition planning");
    logger.code("Then run: gs plan");

    this.persist();
    return { success: true, message: "Brainstorming phase started" };
  }

  async plan(force: boolean = false): Promise<CommandResult> {
    const targetPhase: Phase = "planning";

    if (this.state.currentPhase === "planning") {
      logger.log("warn", "Planning already active. Continuing...");
      logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
      await this.ensureGitNexusIndex();
      logger.code("OpenCode will load 'gs' skill → planning workflow");
      this.persist();
      return { success: true, message: "Planning phase continued" };
    }

    if (!force && !this.checkPreviousPhaseComplete(targetPhase)) {
      return {
        success: false,
        message: `Cannot plan yet. Brainstorming is not complete.\n  → Go to OpenCode, call gs_record_output.\n  → Or use 'gs plan --force'.`,
      };
    }

    const result = transitionTo(this.state, targetPhase, true);
    if (!result.success) {
      return { success: false, message: result.reason };
    }
    this.state = result.state;

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);
    await this.ensureGitNexusIndex();

    logger.divider();
    logger.code("OpenCode will load 'gs' skill → planning workflow");
    logger.code("Output required: .gs/plan.md");
    logger.code("MCP: gs_record_output → gs_propose_transition implementing");
    logger.code("Then run: gs implement");

    this.persist();
    return { success: true, message: "Planning phase started" };
  }

  async implement(force: boolean = false): Promise<CommandResult> {
    const targetPhase: Phase = "implementing";

    if (this.state.currentPhase === "implementing") {
      logger.log("warn", "Implementation already active. Continuing...");
      logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
      await this.ensureGitNexusIndex();
      this.persist();
      return { success: true, message: "Implementation phase continued" };
    }

    if (!force && !this.checkPreviousPhaseComplete(targetPhase)) {
      return {
        success: false,
        message: `Cannot implement yet. Planning is not complete.\n  → Go to OpenCode, call gs_record_output.\n  → Or use 'gs implement --force'.`,
      };
    }

    const result = transitionTo(this.state, targetPhase, true);
    if (!result.success) {
      return { success: false, message: result.reason };
    }
    this.state = result.state;

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);

    const tasks = this.state.plan.tasks.filter((t) => t.status !== "completed");
    if (tasks.length > 0) {
      logger.step(`Pending tasks: ${tasks.length}`);
      for (const task of tasks.slice(0, 5)) {
        logger.step(`  [${task.id}] ${task.description}`);
      }
    }

    await this.ensureGitNexusIndex();

    logger.divider();
    logger.code("OpenCode will execute TDD: RED → GREEN → REFACTOR");
    logger.code("MANDATORY: gs_check_file before EVERY file operation");
    logger.code("MANDATORY: gs_pre_commit before EVERY commit");
    logger.code("MCP: gs_complete_task after each task");
    logger.code("MCP: gs_record_output → gs_propose_transition reviewing");
    logger.code("Check progress: gs status");
    logger.code("When done: gs review");

    this.persist();
    return { success: true, message: "Implementation phase started" };
  }

  async review(force: boolean = false): Promise<CommandResult> {
    const targetPhase: Phase = "reviewing";

    if (this.state.currentPhase === "reviewing") {
      logger.log("warn", "Review already active. Continuing...");
      logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
      await this.ensureGitNexusIndex();
      this.persist();
      return { success: true, message: "Review phase continued" };
    }

    if (!force && !this.checkPreviousPhaseComplete(targetPhase)) {
      return {
        success: false,
        message: `Cannot review yet. Implementation is not complete.\n  → Go to OpenCode, call gs_record_output.\n  → Or use 'gs review --force'.`,
      };
    }

    const result = transitionTo(this.state, targetPhase, true);
    if (!result.success) {
      return { success: false, message: result.reason };
    }
    this.state = result.state;

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);
    await this.ensureGitNexusIndex();

    logger.divider();
    logger.code("OpenCode will review code with GitNexus detect_changes + impact");
    logger.code("MCP: gs_record_output → gs_propose_transition finishing");
    logger.code("Then run: gs finish");

    this.persist();
    return { success: true, message: "Review phase started" };
  }

  async finish(): Promise<CommandResult> {
    const targetPhase: Phase = "finishing";

    if (!this.checkPreviousPhaseComplete(targetPhase)) {
      logger.log("warn", "Previous phase may not be complete. Continuing anyway for finish...");
    }

    const result = transitionTo(this.state, targetPhase, true);
    if (!result.success) {
      return { success: false, message: result.reason };
    }
    this.state = result.state;

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);
    await this.ensureGitNexusIndex();

    completePhase(this.state, "finishing");
    const nextPhase = getNextPhase("finishing");
    if (nextPhase) {
      transitionTo(this.state, nextPhase, false);
    }

    logger.divider();
    logger.log("success", "GS workflow complete!");

    this.persist();
    return { success: true, message: "Workflow finished" };
  }

  status(): string {
    logger.section("GS Workflow Status");

    const phaseOrder = PHASE_ORDER.filter((p) => p !== "idle");
    const currentIdx = this.state.currentPhase === "idle" ? -1 : phaseOrder.indexOf(this.state.currentPhase);

    for (let i = 0; i < phaseOrder.length; i++) {
      const phase = phaseOrder[i] as Phase;
      const phaseState = this.state.phases[phase];
      const isCurrent = i === currentIdx;
      const isCompleted = phaseState.status === "completed";
      const icon = isCurrent ? pc.blue("▶") : isCompleted ? pc.green("✓") : pc.dim("∘");
      const label = isCurrent ? pc.bold(pc.blue(PHASE_LABELS[phase])) : PHASE_LABELS[phase];
      const statusText = isCompleted ? pc.green(" [DONE]") : isCurrent ? pc.cyan(" [ACTIVE]") : "";
      console.log(`   ${icon} ${label}${statusText}`);
    }

    logger.divider();
    const gn = this.state.gitnexus;
    logger.step(`GitNexus: ${gn.indexed ? pc.green("indexed") : pc.yellow("not indexed")}${gn.stale ? pc.yellow(" (stale)") : ""}`);
    logger.step(`Plan tasks: ${this.state.plan.tasks.length} total, ${this.state.plan.tasks.filter((t) => t.status === "completed").length} completed`);
    logger.step(`Workflow #${this.state.meta.workflowCount}`);

    return "";
  }

  async autoIndex(): Promise<void> {
    if (!isGitNexusAvailable()) return;
    const { indexed } = checkIndex(this.projectRoot);
    if (!indexed) {
      logger.log("info", "Indexing codebase with GitNexus...");
      await gitnexusAnalyze(this.projectRoot, false);
      this.state.gitnexus.indexed = true;
      this.state.gitnexus.lastIndexed = new Date().toISOString();
      this.state.gitnexus.stale = false;
      this.persist();
    }
  }

  addPlanTask(task: PlanTask): void {
    this.state.plan.tasks.push(task);
    this.persist();
  }

  completePlanTask(taskId: string): boolean {
    const task = this.state.plan.tasks.find((t) => t.id === taskId);
    if (!task) return false;
    task.status = "completed";
    this.persist();
    return true;
  }

  reset(): CommandResult {
    deleteState(this.projectRoot);
    const projectName = this.projectRoot.split(/[/\\]/).pop() ?? "unknown";
    this.state = createInitialState(projectName);
    this.persist();
    logger.log("success", "GS state reset. Ready for new workflow.");
    return { success: true, message: "State reset" };
  }

  executeTransition(targetPhase: Phase): { success: boolean; message: string; newPhase?: Phase } {
    const currentPhaseState = this.state.phases[this.state.currentPhase];
    const targetIndex = PHASE_ORDER.indexOf(targetPhase);
    const currentIndex = PHASE_ORDER.indexOf(this.state.currentPhase);

    const isBackward = targetIndex < currentIndex;

    if (!isBackward && currentPhaseState.status !== "completed") {
      return {
        success: false,
        message: `Current phase "${this.state.currentPhase}" is not complete (status: ${currentPhaseState.status}). Call gs_record_output first.`,
      };
    }

    if (!canTransition(this.state.currentPhase, targetPhase)) {
      return {
        success: false,
        message: `Cannot transition from "${this.state.currentPhase}" to "${targetPhase}". Not a valid forward or backward jump.`,
      };
    }

    if (isBackward) {
      this.state.phases[this.state.currentPhase].status = "pending";
      this.state.phases[this.state.currentPhase].completedAt = null;
    }

    const result = transitionTo(this.state, targetPhase, false);
    if (!result.success) {
      return { success: false, message: result.reason };
    }
    this.state = result.state;
    this.persist();

    const direction = isBackward ? "Rolled back to" : "Transitioned to";
    return {
      success: true,
      message: `${direction} "${targetPhase}".`,
      newPhase: targetPhase,
    };
  }

  markPhaseComplete(output: string): { success: boolean; message: string } {
    completePhase(this.state, this.state.currentPhase);
    addPhaseNote(this.state, this.state.currentPhase, `Output: ${output}`);
    this.persist();
    return {
      success: true,
      message: `Phase "${this.state.currentPhase}" completed. Call gs_propose_transition to move forward.`,
    };
  }

  private async ensureGitNexusIndex(): Promise<void> {
    if (!isGitNexusAvailable()) {
      logger.log("warn", "GitNexus not available. Skipping graph context. Install: npm install -g gitnexus");
      return;
    }
    const { indexed, stale } = checkIndex(this.projectRoot);
    if (indexed) {
      this.state.gitnexus.indexed = true;
      this.state.gitnexus.lastIndexed = new Date().toISOString();
      this.state.gitnexus.stale = stale;
      logger.log("success", "GitNexus index is up to date.");
      this.persist();
      return;
    }
    logger.log("info", "Running GitNexus analysis...");
    const result = await gitnexusAnalyze(this.projectRoot, stale);
    if (result.success) {
      this.state.gitnexus.indexed = true;
      this.state.gitnexus.lastIndexed = new Date().toISOString();
      this.state.gitnexus.stale = false;
      this.persist();
    }
  }
}
