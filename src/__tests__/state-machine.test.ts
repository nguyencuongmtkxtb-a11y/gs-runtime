import { describe, it, expect, beforeEach } from "vitest";
import {
  createInitialState,
  canTransitionTo,
  transitionTo,
  getNextPhase,
  parsePlanTasks,
  completePhase,
} from "../shared/state.js";
import type { GSState, Phase } from "../shared/types.js";

describe("State Machine", () => {
  let state: GSState;

  beforeEach(() => {
    state = createInitialState("test-project");
  });

  describe("createInitialState", () => {
    it("should create state with idle phase completed", () => {
      expect(state.currentPhase).toBe("idle");
      expect(state.phases.idle.status).toBe("completed");
      expect(state.workflowMode).toBe("full");
      expect(state.isUITask).toBe(false);
    });

    it("should use provided project name", () => {
      const s = createInitialState("my-app");
      expect(s.project).toBe("my-app");
    });

    it("should default to 'unknown' without project name", () => {
      const s = createInitialState();
      expect(s.project).toBe("unknown");
    });
  });

  describe("canTransitionTo", () => {
    it("should allow forward transition to next phase", () => {
      expect(canTransitionTo("idle", "brainstorming")).toBe(true);
      expect(canTransitionTo("brainstorming", "planning")).toBe(true);
      expect(canTransitionTo("planning", "implementing")).toBe(true);
      expect(canTransitionTo("implementing", "reviewing")).toBe(true);
      expect(canTransitionTo("reviewing", "finishing")).toBe(true);
      expect(canTransitionTo("finishing", "completed")).toBe(true);
    });

    it("should allow backward transition by one phase", () => {
      expect(canTransitionTo("planning", "brainstorming")).toBe(true);
      expect(canTransitionTo("implementing", "planning")).toBe(true);
      expect(canTransitionTo("reviewing", "implementing")).toBe(true);
      expect(canTransitionTo("finishing", "reviewing")).toBe(true);
    });

    it("should NOT allow skipping phases forward", () => {
      expect(canTransitionTo("idle", "planning")).toBe(false);
      expect(canTransitionTo("brainstorming", "implementing")).toBe(false);
      expect(canTransitionTo("idle", "reviewing")).toBe(false);
    });

    it("should NOT allow backward jump of 2+ phases", () => {
      expect(canTransitionTo("implementing", "brainstorming")).toBe(false);
      expect(canTransitionTo("reviewing", "planning")).toBe(false);
    });
  });

  describe("transitionTo", () => {
    it("should transition with markCurrentComplete=true", () => {
      const result = transitionTo(state, "brainstorming", true);
      expect(result.success).toBe(true);
      expect(result.state.currentPhase).toBe("brainstorming");
      expect(result.state.phases.idle.status).toBe("completed");
      expect(result.state.phases.brainstorming.status).toBe("in_progress");
    });

    it("should fail transition without completing current phase", () => {
      state.currentPhase = "brainstorming";
      state.phases.brainstorming.status = "in_progress";
      const result = transitionTo(state, "planning", false);
      expect(result.success).toBe(false);
    });

    it("should allow transition after phase is completed", () => {
      state.currentPhase = "brainstorming";
      state.phases.brainstorming.status = "completed";
      const result = transitionTo(state, "planning", false);
      expect(result.success).toBe(true);
      expect(result.state.currentPhase).toBe("planning");
    });
  });

  describe("getNextPhase", () => {
    it("should return next phase in order", () => {
      expect(getNextPhase("idle")).toBe("brainstorming");
      expect(getNextPhase("brainstorming")).toBe("planning");
      expect(getNextPhase("planning")).toBe("implementing");
      expect(getNextPhase("implementing")).toBe("reviewing");
      expect(getNextPhase("reviewing")).toBe("finishing");
      expect(getNextPhase("finishing")).toBe("completed");
    });

    it("should return null for completed phase", () => {
      expect(getNextPhase("completed")).toBe(null);
    });
  });
});

describe("Plan Parser", () => {
  it("should parse ### T1 — format", () => {
    const content = `# Plan
### T1 — Create auth module
- **Files**: \`src/auth/index.ts\`, \`src/auth/types.ts\`
- **Tests**: \`src/auth/__tests__/auth.test.ts\`
- **Priority**: high
- **Est**: 5 min
`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("t1");
    expect(tasks[0].files).toContain("src/auth/index.ts");
    expect(tasks[0].files).toContain("src/auth/types.ts");
    expect(tasks[0].tests).toContain("src/auth/__tests__/auth.test.ts");
    expect(tasks[0].priority).toBe("high");
    expect(tasks[0].estimatedMinutes).toBe(5);
  });

  it("should parse ### Task 1: format", () => {
    const content = `# Plan
### Task 1: Setup database connection
- **Files**: \`src/db/connection.ts\`
`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].description).toContain("Setup database connection");
  });

  it("should parse ### 1. format (numbered list)", () => {
    const content = `# Plan
### 1. Initialize project structure
- **Files**: \`src/index.ts\`

### 2. Add routing
- **Files**: \`src/router.ts\`
`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe("t1");
    expect(tasks[1].id).toBe("t2");
  });

  it("should parse ### Step 1 — format", () => {
    const content = `# Plan
### Step 1 — Setup env config
- **Files**: \`src/config.ts\`
`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("step_1");
  });

  it("should handle multiple tasks correctly", () => {
    const content = `# Implementation Plan
### T1 — First task
- **Files**: \`src/a.ts\`
- **Priority**: high

### T2 — Second task
- **Files**: \`src/b.ts\`
- **Priority**: low
- **Est**: 10 min
`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0].priority).toBe("high");
    expect(tasks[1].priority).toBe("low");
    expect(tasks[1].estimatedMinutes).toBe(10);
  });

  it("should return empty array for content without tasks", () => {
    const content = `# Some random markdown\n\nNo tasks here.`;
    const tasks = parsePlanTasks(content);
    expect(tasks).toHaveLength(0);
  });
});
