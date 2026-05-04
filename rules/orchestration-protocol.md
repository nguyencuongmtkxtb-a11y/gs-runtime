# Agent Orchestration Protocol

How GS coordinates multiple specialized agents within a single workflow session.

## Agent Roles

| Agent | Purpose | Trigger |
|-------|---------|---------|
| **gs** (dispatcher) | Main workflow orchestrator. Enforces phases, delegates to specialists. | Every conversation |
| **planner** | Feature decomposition, blast radius, risk assessment, plan generation | brainstorming → planning transition |
| **implementer** | Code generation following TDD: red → green → refactor | Each plan task |
| **reviewer** | Adversarial code review: security, correctness, quality, design | implementing → reviewing transition |
| **tester** | Test generation: unit, integration, E2E | Before implementer writes code |
| **simplifier** | Code simplification: dedup, modularize, improve naming | After 5+ edits or pre-review |

## Delegation Protocol

### Context to pass to subagents

When delegating to a subagent, ALWAYS inject:

1. **Task description** — what to do, not how
2. **Plan context** — which plan task(s) this relates to
3. **File paths** — exact files to work on
4. **Design tokens** — colors, fonts, spacing from loaded design system (if UI)
5. **Constraints** — phase restrictions, naming conventions, code standards
6. **Expected output** — what file(s) should be created/modified

### Subagent Status Protocol

After completing a task, subagents return one of:

| Status | Meaning | Action |
|--------|---------|--------|
| `DONE` | Task completed successfully | Mark task complete, proceed to next |
| `DONE_WITH_CONCERNS` | Task done but has potential issues | Log concerns, continue, reviewer will check |
| `BLOCKED` | Cannot proceed | Report blocker to user, skip task |
| `NEEDS_CONTEXT` | Missing information to complete | Request specific context from dispatcher |

### Task Chaining

Subagents can be chained sequentially or in parallel:

```
Sequential:          Parallel (independent tasks):
  planner               tester (task 1)
    → implementer        tester (task 2)
      → reviewer       ───────────────
        → simplifier      implementer (task 1)
                           implementer (task 2)
                         ───────────────
                           reviewer (all)
```

### Context Isolation

Each subagent operates with a fresh context containing only:
- The specific task description
- The files it needs to read/write
- The relevant plan excerpt
- The loaded design tokens (if applicable)

**Never** pass the entire session context to a subagent — this degrades their focus and wastes tokens.

## Anti-Patterns

| Anti-Pattern | Why it fails | Correct approach |
|-------------|-------------|-----------------|
| One giant agent doing everything | Context overload, poor specialization | Delegate to specialists |
| Re-doing completed work | Wastes time, introduces conflicts | Check session state before starting |
| Subagent modifying unplanned files | Plan drift, unexpected side effects | Enforce via `gs_check_file` |
| Not injecting design tokens for UI tasks | Ad-hoc CSS, inconsistent design | Always pass loaded design system |
| Parallel agents sharing mutable state | Race conditions, merge conflicts | Isolate file scopes, sequential writes |

## Session State

When delegating, update session state:
- **Before**: Log the delegation (agent name, task ID)
- **After**: Append subagent result to session state
- **On compact recovery**: Re-hydrate plan tasks and completed status from session state
