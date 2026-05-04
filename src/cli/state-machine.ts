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
  parsePlanTasks,
} from "../shared/state.js";
import { analyze as gitnexusAnalyze, checkIndex, isAvailable as isGitNexusAvailable } from "../gitnexus/bridge.js";
import { logger } from "../shared/logger.js";
import { writeFileSync, existsSync, mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { buildAgentsMd } from "./context-injector.js";
import { scaffoldProject } from "./scaffold.js";
import { createInitialSession, loadSession, saveSession, updateSessionFromState, ensureSessionDir } from "../shared/session-state.js";
import pc from "picocolors";

function buildDesignTemplate(description: string, isUITask: boolean): string {
  return `# Design Document

## Feature Description
${description}

## Requirements
<!-- Functional and non-functional requirements -->

### Functional
- 

### Non-Functional
- Performance: 
- Security: 
- Accessibility: 

## Architecture Decisions
<!-- Key architectural choices and rationale -->

| Decision | Rationale |
|----------|-----------|

## Existing Patterns
<!-- Relevant codebase patterns found via GitNexus query -->

## Dependencies
<!-- What does this feature depend on? -->

## Constraints
<!-- Technical, business, or timeline constraints -->

## Open Questions
<!-- Questions that need answers before planning -->

${isUITask ? `## Design System
<!-- Chosen design system — determined during brainstorming via MCP tools -->
- **System**: (run gs ui or gs_search_design_systems to pick)
- **Skills**: (run gs_list_design_skills to pick)
- **Tokens**: (run gs_load_design_system to load)

## Visual Direction
<!-- Describe the visual style: colors, typography, layout -->

` : ""}
## Next Steps
1. Fill in the sections above
2. Call \`gs_record_output\` with ".gs/design.md"
3. Call \`gs_propose_transition\` with target "planning"
4. Run \`gs plan\`
`;
}

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
      logger.log("success", "GitNexus CLI detected. Indexing codebase...");
      await this.autoIndex();
      // Verify MCP config
      const mcpConfigOk = this.checkGitNexusMCPConfig();
      if (!mcpConfigOk) {
        logger.log("warn", "GitNexus MCP server NOT found in OpenCode config.");
        logger.log("warn", "Agent won't have graph tools (query, context, impact) without it.");
        logger.code("Add to ~/.config/opencode/config.json → mcp:");
        logger.code('  "gitnexus": { "type": "local", "command": ["gitnexus", "mcp"] }');
      }
    } else {
      logger.log("warn", "GitNexus not found. Install to enable graph features (review, impact analysis):");
      logger.code("npm install -g gitnexus");
      logger.code("gitnexus index");
    }

    const agentsPath = join(this.projectRoot, "AGENTS.md");
    writeFileSync(agentsPath, buildAgentsMd(), "utf-8");
    logger.log("success", "AGENTS.md generated with GS + Open Design rules.");

    const scaffold = scaffoldProject(this.projectRoot, this.state.project);
    if (scaffold.created.length > 0) {
      logger.log("success", `Scaffolded ${scaffold.created.length} files:`);
      for (const f of scaffold.created) {
        logger.step(`  + ${f}`);
      }
    }
    if (scaffold.skipped.length > 0) {
      logger.log("info", `Skipped ${scaffold.skipped.length} existing files.`);
    }

    logger.log("info", "GS initialized.");
    logger.log("info", 'Next: gs brainstorm "your feature description"');
    ensureSessionDir(this.projectRoot);
    const existingSession = loadSession(this.projectRoot);
    const session = existingSession ?? createInitialSession(this.state.project);
    session.phase = "idle";
    session.lastAction = "gs init";
    session.lastActionTime = new Date().toISOString();
    saveSession(this.projectRoot, session);
    return { success: true, message: "GS initialized successfully" };
  }

  async brainstorm(description: string, isUI: boolean = false): Promise<CommandResult> {
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

    const isUITask = isUI;
    this.state.isUITask = isUITask;

    logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
    logger.step(description);
    logger.step(PHASE_DESCRIPTIONS[targetPhase]);
    await this.ensureGitNexusIndex();

    const designPath = join(this.projectRoot, ".gs", "design.md");
    if (!existsSync(designPath)) {
      mkdirSync(join(this.projectRoot, ".gs"), { recursive: true });
      const template = buildDesignTemplate(description, isUITask);
      writeFileSync(designPath, template, "utf-8");
      logger.log("success", ".gs/design.md template created. Fill in details, then gs_record_output.");
    }

    logger.divider();
    logger.code("Go to OpenCode — agent will handle the full workflow automatically.");
    logger.code("Agent transitions phases via MCP. No further terminal commands needed.");
    if (isUITask) {
      logger.step("UI task detected — Open Design enforcement active.");
    }

    this.persist();
    updateSessionFromState(
      createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs brainstorm",
    );
    return { success: true, message: "Brainstorming phase started" };
  }

  async quick(description: string): Promise<CommandResult> {
    if (this.state.currentPhase !== "idle" && this.state.currentPhase !== "completed") {
      return {
        success: false,
        message: `Cannot start quick mode. Current phase: ${PHASE_LABELS[this.state.currentPhase]}. Run 'gs reset' first.`,
      };
    }

    // Quick mode: skip brainstorm/plan, go straight to implementing with relaxed rules
    this.state.workflowMode = "quick";

    // Mark brainstorm + planning as completed (skipped)
    this.state.phases.brainstorming.status = "completed";
    this.state.phases.brainstorming.startedAt = new Date().toISOString();
    this.state.phases.brainstorming.completedAt = new Date().toISOString();
    this.state.phases.brainstorming.notes.push("Skipped (quick mode)");
    this.state.phases.planning.status = "completed";
    this.state.phases.planning.startedAt = new Date().toISOString();
    this.state.phases.planning.completedAt = new Date().toISOString();
    this.state.phases.planning.notes.push("Skipped (quick mode)");

    // Jump to implementing
    this.state.currentPhase = "implementing";
    this.state.phases.implementing.status = "in_progress";
    this.state.phases.implementing.startedAt = new Date().toISOString();

    logger.section("Quick Mode — Lightweight Workflow");
    logger.step(description);
    logger.step("Skipped: brainstorm, plan");
    logger.step("Enforced: gs_check_file (write), gs_pre_commit (security scan)");
    logger.step("File writes: unrestricted (no plan task gate)");

    await this.ensureGitNexusIndex();

    logger.divider();
    logger.code("Agent can read/write any file freely");
    logger.code("MANDATORY: gs_pre_commit before EVERY commit");
    logger.code("When done: gs_propose_transition reviewing (or gs finish)");

    this.persist();
    updateSessionFromState(
      createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs quick",
    );
    return { success: true, message: "Quick mode started — implementing with relaxed rules" };
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
    logger.code("Agent handles planning automatically. No further terminal commands needed.");

    this.persist();
    updateSessionFromState(
      loadSession(this.projectRoot) ?? createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs plan",
    );
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

    // Auto-parse plan tasks from plan.md if not already registered
    if (this.state.plan.tasks.length === 0) {
      const planPath = join(this.projectRoot, ".gs", "plan.md");
      if (existsSync(planPath)) {
        const planContent = readFileSync(planPath, "utf-8");
        const extracted = parsePlanTasks(planContent);
        if (extracted.length > 0) {
          this.state.plan.tasks = extracted;
          if (!this.state.plan.createdAt) {
            this.state.plan.createdAt = new Date().toISOString();
          }
          logger.log("success", `Parsed ${extracted.length} tasks from plan.md`);
        }
      }
    }

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
    logger.code("Agent handles implementation automatically (TDD cycle).");
    logger.code("Check progress: gs status");

    this.persist();
    updateSessionFromState(
      loadSession(this.projectRoot) ?? createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs implement",
    );
    return { success: true, message: "Implementation phase started" };
  }

  async review(force: boolean = false): Promise<CommandResult> {
    const targetPhase: Phase = "reviewing";

    if (this.state.currentPhase === "reviewing") {
      logger.log("warn", "Review already active. Continuing...");
      logger.section(`Phase: ${PHASE_LABELS[targetPhase]}`);
      await this.reindexGitNexus();
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
    await this.reindexGitNexus();

    logger.divider();
    logger.code("Agent handles review automatically. Transitions to finish when done.");

    this.persist();
    updateSessionFromState(
      loadSession(this.projectRoot) ?? createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs review",
    );
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

    const planPath = join(this.projectRoot, ".gs", "plan.md");
    if (existsSync(planPath)) {
      const plansDir = join(this.projectRoot, "plans");
      if (!existsSync(plansDir)) mkdirSync(plansDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
      const archiveName = `${timestamp}-${this.state.project.toLowerCase().replace(/\s+/g, "-")}.md`;
      const archivePath = join(plansDir, archiveName);
      copyFileSync(planPath, archivePath);
      logger.log("success", `Plan archived to plans/${archiveName}`);
    }

    this.persist();
    updateSessionFromState(
      loadSession(this.projectRoot) ?? createInitialSession(this.state.project),
      this.state,
      this.projectRoot,
      "gs finish",
    );
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

    if (this.state.currentPhase === "brainstorming") {
      const designPath = join(this.projectRoot, ".gs", "design.md");
      if (!existsSync(designPath)) {
        logger.log("warn", "Design doc (.gs/design.md) is MISSING. Agent must create it before transitioning to planning.");
      }
    }
    if (this.state.currentPhase === "planning") {
      const planPath = join(this.projectRoot, ".gs", "plan.md");
      if (!existsSync(planPath)) {
        logger.log("warn", "Plan (.gs/plan.md) is MISSING. Agent must create it before transitioning to implementing.");
      }
    }

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

  async reindexGitNexus(): Promise<void> {
    if (!isGitNexusAvailable()) return;
    logger.log("info", "Refreshing GitNexus index for review...");
    const { stale } = checkIndex(this.projectRoot);
    const result = await gitnexusAnalyze(this.projectRoot, true);
    if (result.success) {
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

  clearPlanTasks(): void {
    this.state.plan.tasks = [];
    if (!this.state.plan.createdAt) {
      this.state.plan.createdAt = new Date().toISOString();
    }
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

  private checkGitNexusMCPConfig(): boolean {
    const configPaths = [
      join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config", "opencode", "config.json"),
      join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config", "opencode", "config.toml"),
    ];
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const raw = readFileSync(configPath, "utf-8");
          // Simple check: does it mention gitnexus in MCP section?
          if (raw.includes("gitnexus") && (raw.includes("mcp") || raw.includes("[mcp"))) {
            return true;
          }
        } catch {
          // Can't read — assume not configured
        }
      }
    }
    return false;
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
