# Code Standards — GS Runtime

## Principles

- **KISS**: Keep it simple. The state machine has 6 clear phases. No hidden modes.
- **YAGNI**: Only implement what GS actually needs. Scaffold templates are comprehensive but optional.
- **DRY**: Shared types in `types.ts`, shared state logic in `state.ts`, shared logging in `logger.ts`.
- **Single Responsibility**: Each file does one thing. `scaffold.ts` only generates templates. `privacy-block.ts` only detects sensitive files.

## Project Structure

```
src/
├── cli/            # User-facing CLI commands
│   ├── index.ts        # Command definitions
│   ├── state-machine.ts # Phase logic
│   ├── context-injector.ts # AGENTS.md + phase instructions
│   └── scaffold.ts    # Project templates
├── mcp/            # MCP server (enforcement layer)
│   ├── server.ts       # Tool handlers + hook integration
│   └── design-tools.ts # Open Design tool handlers
├── design/         # Open Design integration
│   ├── skill-loader.ts
│   ├── design-system-loader.ts
│   ├── agent-detector.ts
│   ├── prompt-composer.ts
│   └── types.ts
├── hooks/          # Tool-level enforcement
│   ├── privacy-block.ts
│   ├── scout-block.ts
│   ├── security-scan.ts
│   ├── post-edit-simplify.ts
│   └── plan-format-validator.ts
├── gitnexus/       # GitNexus bridge
│   └── bridge.ts
└── shared/         # Core utilities
    ├── types.ts
    ├── state.ts
    ├── session-state.ts
    └── logger.ts
```

## Naming Conventions

### Files
- **kebab-case** for all files: `state-machine.ts`, `privacy-block.ts`, `design-system-loader.ts`
- Long descriptive names preferred: `post-edit-simplify.ts` over `simplify.ts`

### Code
- Variables/functions: camelCase — `loadState`, `checkPrivacy`, `buildAgentsMd`
- Classes/Interfaces: PascalCase — `StateMachine`, `MCPWorkflowStatus`
- Constants: UPPER_SNAKE_CASE — `SESSION_DIR`, `MAX_ARCHIVE`, `SIMPLIFY_THRESHOLD`
- Type parameters: single letter or PascalCase — `T`, `Phase`

## File Size

- **Max 200 lines** per file
- Modularize when exceeded
- Exceptions: `server.ts` (MCP handlers), config files, shell scripts

## Code Quality

- Prefer pure functions: `checkPrivacy(filePath)` returns result without side effects
- Early returns over deep nesting: phase checks return immediately on violation
- Type everything: No `any` in core logic. `Record<string, unknown>` for dynamic data.
- Descriptive error messages: `"Cannot plan yet. Brainstorming is not complete."`

## Testing

- All new hooks must have unit tests
- Test behavior via `gs init` in temp directory integration tests
- Eval Tier 1 validates all SKILL.md frontmatter on every build

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Branch naming: `feature/<name>`, `fix/<name>`
- **NEVER commit `.gs/state.json`** — it's gitignored
- **NEVER commit secrets or `.env`** — privacy block enforces this

## Design (Open Design Integration)

- All design system tokens loaded via `gs_load_design_system`
- Prompt composition via `gs_compose_design_prompt`
- Anti-slop enforced: no Lorem ipsum, no ad-hoc CSS
- Design output verified against DESIGN.md in review phase

## Dependencies

- **Minimal**: Only `commander`, `picocolors`, `@modelcontextprotocol/sdk`
- No ORMs, no frameworks, no build tools (plain tsc)
- GitNexus is optional peer dependency
- Open Design is a git submodule, not an npm dependency
