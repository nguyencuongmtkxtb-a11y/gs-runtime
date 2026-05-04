# GS + Open Design Integration — Implementation Plan

## Overview

Tích hợp open-design làm git submodule, nâng cấp Node 24, thêm web UI, 57 design skills, 129 design systems, agent detection, prompt stack.

## Phase 1: Foundation

### T1.1 — Add open-design as git submodule
- **Files**: `.gitmodules` (create), `integrations/` (create dir)
- **Action**: `git submodule add https://github.com/nexu-io/open-design.git integrations/open-design`
- **Verify**: `git submodule status` shows open-design, `ls integrations/open-design/` shows files
- **Est**: 3 min
- **Priority**: high

### T1.2 — Upgrade Node.js requirement to 24
- **Files**: `package.json` (edit `engines.node`)
- **Action**: Change `"node": ">=18.0.0"` → `"node": ">=24.0.0"`, add `"packageManager": "pnpm@10.33.2"`
- **Verify**: `node --version` >= 24
- **Est**: 2 min
- **Priority**: high

### T1.3 — Create pnpm-workspace.yaml
- **Files**: `pnpm-workspace.yaml` (create), `package.json` (edit scripts)
- **Content**: Mirror open-design workspace structure: `apps/*`, `packages/*`, `tools/*`, `e2e`
- **Verify**: `pnpm install` succeeds
- **Est**: 3 min
- **Priority**: high

### T1.4 — Update tsconfig.json for broader paths
- **Files**: `tsconfig.json` (edit)
- **Action**: Add `paths` for `@gs/*`, `@gs/design/*`, `integrations/*`; include `integrations/open-design/skills/**`
- **Verify**: `npm run typecheck` passes
- **Est**: 3 min
- **Priority**: medium

### T1.5 — Create OD-bridge skill
- **Files**: `skills/od-bridge/SKILL.md` (create)
- **Content**: Bridge skill mapping GS phases → OD design skills, describing how agents load design skills and design systems. Include `od:` frontmatter for daemon parsing.
- **Verify**: Skill loadable via `Skill` tool
- **Est**: 5 min
- **Priority**: high

### T1.6 — Update AGENTS.md with design integration
- **Files**: `AGENTS.md` (edit)
- **Action**: Add section about Open Design integration — available design skills, design systems, agent detection, usage in each phase
- **Verify**: Manual review of AGENTS.md
- **Est**: 4 min
- **Priority**: medium

### T1.7 — Create .gitignore entries for runtime folders
- **Files**: `.gitignore` (edit)
- **Action**: Add `.od/`, `.tmp/`, `.gs/state.json`
- **Verify**: `git status` ignores runtime folders
- **Est**: 2 min
- **Priority**: medium

## Phase 2: Skill & Design System Loader

### T2.1 — Create design module skeleton
- **Files**: `src/design/types.ts` (create), `src/design/index.ts` (create)
- **Content**: Types for `DesignSkill`, `DesignSystem`, `AgentInfo`, `PromptTemplate`. Export barrel.
- **Tests**: `src/design/__tests__/types.test.ts` — verify type exports
- **Verify**: `npm run typecheck`
- **Est**: 4 min
- **Priority**: high

### T2.2 — Implement skill-loader.ts
- **Files**: `src/design/skill-loader.ts` (create)
- **Content**: Function `scanSkills(rootPath: string): DesignSkill[]` — recursively reads `integrations/open-design/skills/`, parses SKILL.md frontmatter (YAML `---` blocks with `od:` fields), returns structured skill list. Cache layer with `Map<string, DesignSkill>`.
- **Tests**: `src/design/__tests__/skill-loader.test.ts`
  - Test: scans skills directory, returns non-empty array
  - Test: parses `od:` frontmatter fields (mode, platform, scenario)
  - Test: handles missing SKILL.md gracefully
  - Test: cache returns same result on second call
- **Verify**: `npm run typecheck && npm test`
- **Est**: 5 min
- **Priority**: high

### T2.3 — Implement design-system-loader.ts
- **Files**: `src/design/design-system-loader.ts` (create)
- **Content**: Function `loadDesignSystem(name: string): DesignSystem | null` — reads `integrations/open-design/design-systems/<name>/DESIGN.md`, parses H1 title, category line `> Category:`, 9-section content. Function `listDesignSystems(): DesignSystemSummary[]` — lists all available systems with name + category. Cache with LRU eviction (max 10).
- **Tests**: `src/design/__tests__/design-system-loader.test.ts`
  - Test: loads a specific design system by name
  - Test: lists all available systems
  - Test: returns null for non-existent system
  - Test: parses category line correctly
  - Test: cache eviction when max reached
- **Verify**: `npm run typecheck && npm test`
- **Est**: 5 min
- **Priority**: high

### T2.4 — Register MCP tools for design skills/systems
- **Files**: `src/mcp/server.ts` (edit), `src/mcp/design-tools.ts` (create)
- **Content**: Add 3 new MCP tools:
  - `gs_list_design_skills` — returns all 57 skills grouped by scenario
  - `gs_load_design_system` — loads a specific DESIGN.md by name, returns full content
  - `gs_search_design_systems` — fuzzy search by name/category keyword
- **Tests**: `src/mcp/__tests__/design-tools.test.ts`
  - Test: gs_list_design_skills returns structured list
  - Test: gs_load_design_system returns content for valid name
  - Test: gs_load_design_system errors for invalid name
  - Test: gs_search_design_systems matches partial keywords
- **Verify**: MCP tools listed in `ListToolsRequestSchema` response
- **Est**: 5 min
- **Priority**: high

### T2.5 — Create design system context injection
- **Files**: `src/design/context-injector.ts` (create)
- **Content**: Function `buildDesignContext(designSystemName?: string): string` — generates formatted context block for injection into agent system prompt. Includes active design system tokens (colors, typography, spacing) when a system is selected.
- **Tests**: `src/design/__tests__/context-injector.test.ts`
  - Test: generates context block with design system selected
  - Test: generates empty context when no system selected
  - Test: includes color/typography/spacing sections
- **Verify**: Output matches expected format
- **Est**: 4 min
- **Priority**: medium

## Phase 3: Agent Detection

### T3.1 — Implement agent-detector.ts
- **Files**: `src/design/agent-detector.ts` (create)
- **Content**: Function `detectAgents(): AgentInfo[]` — scans PATH for 13 known CLI agents: `claude`, `codex`, `devin`, `cursor-agent`, `gemini`, `opencode`, `qwen`, `copilot`, `hermes`, `kimi`, `pi`, `kiro-cli`, `vibe-acp`. Uses `which`/`where` to check availability. Each agent has: name, displayName, path, protocol (stdio/acp/rpc), available (boolean).
- **Tests**: `src/design/__tests__/agent-detector.test.ts`
  - Test: detects agents present on PATH
  - Test: returns empty array when none found
  - Test: each detected agent has valid structure
  - Test: mock which/where for unit testing
- **Verify**: `npm run typecheck && npm test`
- **Est**: 5 min
- **Priority**: high

### T3.2 — Register MCP tool for agent detection
- **Files**: `src/mcp/server.ts` (edit), `src/mcp/design-tools.ts` (edit)
- **Content**: Add MCP tool `gs_detect_agents` — runs detectAgents(), returns structured list of available agents
- **Verify**: MCP tool returns correct agent list
- **Est**: 3 min
- **Priority**: high

### T3.3 — Add CLI command `gs agents`
- **Files**: `src/cli/index.ts` (edit)
- **Content**: New command `gs agents --list` — prints detected agents with colored output (green=available, dim=not found). `gs agents --select <name>` — sets preferred agent in state.
- **Verify**: `gs agents --list` shows detected agents
- **Est**: 4 min
- **Priority**: medium

### T3.4 — Add agent preference to state
- **Files**: `src/shared/types.ts` (edit), `src/shared/state.ts` (edit)
- **Content**: Add `preferredAgent?: string` to GSState. Add `setPreferredAgent()` and `getPreferredAgent()` to state module.
- **Verify**: Preference persists across state save/load
- **Est**: 3 min
- **Priority**: medium

### T3.5 — Integrate agent detection into workflow status
- **Files**: `src/cli/state-machine.ts` (edit)
- **Content**: During `brainstorm()`, auto-detect agents and show availability. Store in state.
- **Verify**: `gs brainstorm "test"` shows agent availability
- **Est**: 3 min
- **Priority**: medium

## Phase 4: Prompt Enhancement

### T4.1 — Create design-discovery.md prompt template
- **Files**: `prompts/design-discovery.md` (create)
- **Content**: Turn-1 discovery form protocol. Rules:
  - RULE 1: Every design brief begins with `<question-form id="discovery">` instead of code
  - Required fields: surface (desktop/mobile/print), audience, tone, brand context, scale, constraints
  - Junior-Designer mode: batch questions upfront, show wireframe early
- **Verify**: Template is valid markdown, includes all required sections
- **Est**: 4 min
- **Priority**: high

### T4.2 — Create design-critique.md prompt template
- **Files**: `prompts/design-critique.md` (create)
- **Content**: 5-dimensional critique protocol:
  - Philosophy (triết lý thiết kế) — 1-10
  - Hierarchy (phân cấp thị giác) — 1-10
  - Detail (chi tiết/tinh chỉnh) — 1-10
  - Function (chức năng/UX) — 1-10
  - Innovation (đổi mới/độc đáo) — 1-10
  - Each dimension requires a reason
- **Verify**: Template includes scoring format and dimension descriptions
- **Est**: 3 min
- **Priority**: high

### T4.3 — Create anti-slop.md prompt template
- **Files**: `prompts/anti-slop.md` (create)
- **Content**: Anti-AI-slop checklist:
  - No generic placeholder text ("Lorem ipsum", "Content goes here")
  - No colors outside active design system
  - No system default fonts — must use curated font stack
  - Must maintain brand consistency across all elements
  - No generic stock photo descriptions
  - All copy must be contextual/relevant
- **Verify**: Template includes all anti-slop rules
- **Est**: 3 min
- **Priority**: high

### T4.4 — Implement prompt-composer.ts
- **Files**: `src/design/prompt-composer.ts` (create)
- **Content**: Function `composeDesignPrompt(params: ComposeParams): string` — composes final system prompt from:
  - Identity charter (OFFICIAL_DESIGNER_PROMPT)
  - Active design system (if selected)
  - Active skill instructions (if selected)
  - Discovery directives (if turn-1)
  - Critique directives (if review phase)
  - Anti-slop checklist (always included)
  - Project metadata (fidelity, speakerNotes, animations)
- **Tests**: `src/design/__tests__/prompt-composer.test.ts`
  - Test: composes prompt with all components
  - Test: composes minimal prompt (no design system, no skill)
  - Test: discovery directives only in turn-1 mode
  - Test: critique directives only in review mode
  - Test: anti-slop checklist always included
- **Verify**: `npm run typecheck && npm test`
- **Est**: 5 min
- **Priority**: high

### T4.5 — Add MCP tool `gs_compose_design_prompt`
- **Files**: `src/mcp/server.ts` (edit), `src/mcp/design-tools.ts` (edit)
- **Content**: MCP tool that calls `composeDesignPrompt()` with user-provided parameters, returns the composed prompt string
- **Verify**: Tool returns composed prompt with correct structure
- **Est**: 3 min
- **Priority**: medium

### T4.6 — Add prompt composition to CLI workflow
- **Files**: `src/cli/state-machine.ts` (edit)
- **Content**: During brainstorm/implement phases, hint agents to use `gs_compose_design_prompt` for design tasks
- **Verify**: Context injection includes design prompt hints
- **Est**: 3 min
- **Priority**: low
