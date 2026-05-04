import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateScoutIgnore } from "../hooks/scout-block.js";

export interface ScaffoldResult {
  created: string[];
  skipped: string[];
}

export function scaffoldProject(root: string, projectName: string): ScaffoldResult {
  const result: ScaffoldResult = { created: [], skipped: [] };

  const write = (relativePath: string, content: string) => {
    const fullPath = join(root, relativePath);
    const dir = join(fullPath, "..");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(fullPath)) {
      result.skipped.push(relativePath);
      return;
    }
    writeFileSync(fullPath, content, "utf-8");
    result.created.push(relativePath);
  };

  write(".editorconfig", editorconfig());
  write(".gitignore", gitignore());
  write(".gsignore", generateScoutIgnore(root));
  write("README.md", readme(projectName));
  write("CLAUDE.md", claudeMd(projectName));
  write("docs/project-overview.md", projectOverview(projectName));
  write("docs/code-standards.md", codeStandards(projectName));
  write("docs/system-architecture.md", systemArchitecture(projectName));
  write("docs/project-roadmap.md", projectRoadmap(projectName));
  write("docs/deployment-guide.md", deploymentGuide(projectName));
  write("plans/templates/feature-plan-template.md", featurePlanTemplate());
  write("plans/templates/bug-fix-template.md", bugFixTemplate());
  write("plans/templates/refactor-template.md", refactorTemplate());
  write("plans/reports/.gitkeep", "");
  write("rules/orchestration-protocol.md", orchestrationProtocol());

  return result;
}

function editorconfig(): string {
  return `# EditorConfig — consistent coding styles across editors
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2

[Makefile]
indent_style = tab

[*.{py,js,ts,tsx,jsx,json,css,html}]
indent_size = 2
`;
}

function gitignore(): string {
  return `# Dependencies
node_modules/
.pnpm-store/
__pycache__/
*.pyc
.venv/

# Build output
dist/
build/
.next/
out/
coverage/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local
!.env.example

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
Desktop.ini

# GS Runtime
.gs/state.json
.gs/*.backup

# Logs
*.log
logs/
*.log.*

# Temp
tmp/
temp/
*.tmp
`;
}

function readme(projectName: string): string {
  return `# ${projectName}

## Overview

Brief description of what this project does and why it exists.

## Architecture

Describe the high-level architecture — key components, data flow, technology choices.

## Getting Started

### Prerequisites

- Node.js >= 18
- OpenCode (https://opencode.ai)

### Setup

\`\`\`bash
git clone <repo-url>
cd ${projectName}
gs init
gs brainstorm "describe your feature"
\`\`\`

### Workflow

This project uses **GS Runtime** (Superpowers + GitNexus + Open Design).
The workflow is enforced automatically by the GS MCP server.

\`\`\`bash
gs brainstorm "your idea"   # Design phase
gs plan                     # Planning phase
gs implement                # Implementation phase
gs review                   # Review phase
gs finish                   # Finalization
\`\`\`

## Documentation

- [Project Overview](docs/project-overview.md)
- [Code Standards](docs/code-standards.md)
- [System Architecture](docs/system-architecture.md)
- [Project Roadmap](docs/project-roadmap.md)
- [Deployment Guide](docs/deployment-guide.md)

## License

TBD
`;
}

function claudeMd(projectName: string): string {
  return `# CLAUDE.md

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents,
and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: \`./.claude/rules/primary-workflow.md\`
- Development rules: \`./.claude/rules/development-rules.md\`
- Orchestration protocols: \`./.claude/rules/orchestration-protocol.md\`
- Documentation management: \`./.claude/rules/documentation-management.md\`

## GS Runtime Integration

This project uses **GS Runtime** (Superpowers + GitNexus + Open Design).
The GS MCP server enforces the workflow. ALWAYS call \`gs_workflow_status\` first
and follow phase restrictions.

## [IMPORTANT] Consider Modularization

- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names
- Write descriptive code comments
- When not to modularize: Markdown files, plain text files, bash scripts, configs

## Documentation Management

Keep all important docs in \`./docs\` folder:

\`\`\`
./docs
├── project-overview.md
├── code-standards.md
├── codebase-summary.md
├── system-architecture.md
├── deployment-guide.md
└── project-roadmap.md
\`\`\`
`;
}

function projectOverview(projectName: string): string {
  return `# Project Overview — ${projectName}

## Purpose

What problem does this project solve? Who is the target audience?

## Core Features

1. Feature one
2. Feature two
3. Feature three

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | TBD |
| Backend | TBD |
| Database | TBD |
| Hosting | TBD |

## Key Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| TBD | TBD | TBD |

## Constraints

- TBD
- TBD

## Success Metrics

- TBD
- TBD
`;
}

function codeStandards(projectName: string): string {
  return `# Code Standards — ${projectName}

## Principles

- **KISS**: Keep it simple. Avoid over-engineering.
- **YAGNI**: You aren't gonna need it. Implement only what's required.
- **DRY**: Don't repeat yourself. Extract shared logic.
- **SOLID**: Single responsibility, open-closed, Liskov substitution, interface segregation, dependency inversion.

## Naming Conventions

### Files
- Use **kebab-case** for all files and directories
- Use long descriptive names — self-documenting for LLM tools
- Examples: \`user-authentication-service.ts\`, \`password-reset-form.tsx\`

### Code
- Variables/functions: camelCase
- Classes/Interfaces: PascalCase
- Constants: UPPER_SNAKE_CASE
- Type parameters: single uppercase letter or PascalCase prefixed with T

## File Size

- **Max 200 lines** per file
- Modularize when exceeded
- Exceptions: configs, shell scripts, plain text, environment files

## Code Quality

- Prefer pure functions over side effects
- Use early returns over deep nesting
- Type everything (no \`any\` unless absolutely necessary)
- Keep functions focused on a single task

## Testing

- All new features require tests (TDD)
- Test behavior, not implementation
- Use descriptive test names: \`should <expected behavior> when <condition>\`

## Git

- Conventional commits: \`feat:\`, \`fix:\`, \`refactor:\`, \`test:\`, \`docs:\`, \`chore:\`
- Branch naming: \`feature/<name>\`, \`fix/<name>\`, \`refactor/<name>\`
- Never commit secrets or \`.env\` files

## Design (Open Design Integration)

- All UI/frontend code MUST use design system tokens
- NEVER use ad-hoc hex colors, fonts, or spacing
- NEVER use "Lorem ipsum" — all copy must be real and contextual
- Load design system via \`gs_load_design_system\` before writing any CSS
`;
}

function systemArchitecture(projectName: string): string {
  return `# System Architecture — ${projectName}

## High-Level Architecture

Describe the system at a high level — diagram or text description.

\`\`\`
[User] → [Frontend] → [API Gateway] → [Services] → [Database]
\`\`\`

## Components

### Frontend

- Framework: TBD
- State management: TBD
- Build tool: TBD

### Backend

- Runtime: TBD
- Framework: TBD
- API style: REST / GraphQL / gRPC

### Database

- Primary: TBD
- Caching: TBD
- Search: TBD

### Infrastructure

- Hosting: TBD
- CI/CD: TBD
- Monitoring: TBD

## Data Flow

Describe how data flows through the system.

1. Step one
2. Step two
3. Step three

## Security

- Authentication: TBD
- Authorization: TBD
- Data encryption: TBD
- Secrets management: TBD

## Integration Points

| System | Purpose | Protocol |
|--------|---------|----------|
| TBD | TBD | TBD |
`;
}

function projectRoadmap(projectName: string): string {
  return `# Project Roadmap — ${projectName}

## Phase 1: Foundation

| Milestone | Status | Target |
|-----------|--------|--------|
| Project scaffold | ✅ Done | — |
| Core infrastructure | ⬜ Todo | TBD |
| CI/CD pipeline | ⬜ Todo | TBD |

## Phase 2: MVP

| Milestone | Status | Target |
|-----------|--------|--------|
| Feature one | ⬜ Todo | TBD |
| Feature two | ⬜ Todo | TBD |

## Phase 3: Production

| Milestone | Status | Target |
|-----------|--------|--------|
| Performance optimization | ⬜ Todo | TBD |
| Security audit | ⬜ Todo | TBD |
| Documentation | ⬜ Todo | TBD |

## Future

- TBD
- TBD
`;
}

function deploymentGuide(projectName: string): string {
  return `# Deployment Guide — ${projectName}

## Environments

| Environment | URL | Branch |
|-------------|-----|--------|
| Development | TBD | dev |
| Staging | TBD | staging |
| Production | TBD | main |

## Prerequisites

- TBD
- TBD

## Build

\`\`\`bash
# Build steps
npm run build
\`\`\`

## Deploy

\`\`\`bash
# Deploy steps
TBD
\`\`\`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| TBD | TBD | TBD |

## Rollback

\`\`\`bash
# Rollback steps
TBD
\`\`\`

## Monitoring

- Health check URL: TBD
- Logs: TBD
- Alerts: TBD
`;
}

function featurePlanTemplate(): string {
  return `# Feature: [Feature Name]

## Executive Summary

Brief 2-3 sentence description of the feature and its value.

## Context

- **Related Issues**: #
- **Design Document**: [link]
- **Dependencies**: List any prerequisite work

## Requirements

### Functional

1. Requirement one
2. Requirement two

### Non-Functional

- Performance: TBD
- Security: TBD
- Accessibility: TBD

## Architecture

Describe how this feature fits into the existing architecture.

## Implementation Plan

### Phase 1: [Name]

| # | Task | Files | Est. | Acceptance |
|---|------|-------|------|------------|
| 1 | TBD | \`path/to/file.ts\` | 5m | Test passes |
| 2 | TBD | \`path/to/file.ts\` | 5m | Test passes |

### Phase 2: [Name]

| # | Task | Files | Est. | Acceptance |
|---|------|-------|------|------------|
| 3 | TBD | \`path/to/file.ts\` | 5m | Test passes |

## Test Strategy

- Unit tests: TBD
- Integration tests: TBD
- E2E tests: TBD

## Security Considerations

- TBD
- TBD

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TBD | Low/Med/High | Low/Med/High | TBD |

## Checklist

- [ ] All tests pass
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Security review
- [ ] Performance verified
`;
}

function bugFixTemplate(): string {
  return `# Bug Fix: [Bug Description]

## Symptom

Describe the observed behavior — what goes wrong?

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen instead?

## Root Cause

Technical explanation of WHY the bug occurs.

## Affected Components

| File | Symbol | Impact |
|------|--------|--------|
| \`path/to/file.ts\` | \`functionName\` | Direct cause |
| \`path/to/file.ts\` | \`ClassName\` | Affected caller |

## Fix

Describe the fix approach.

## Verification

1. Write failing test that reproduces the bug
2. Apply fix
3. Confirm test passes
4. Run full test suite

## Prevention

How can we prevent this class of bug in the future?

- [ ] Add lint rule
- [ ] Add test pattern
- [ ] Update documentation
`;
}

function refactorTemplate(): string {
  return `# Refactor: [Component Name]

## Motivation

Why is this refactor needed? (performance, readability, maintainability, etc.)

## Current State

Describe the current code structure and its problems.

## Target State

Describe the desired code structure after refactoring.

## Blast Radius

| File | Change | Risk |
|------|--------|------|
| \`path/to/file.ts\` | Extract function | Low |
| \`path/to/file.ts\` | Rename class | Medium |

## Plan

| # | Task | Verification |
|---|------|-------------|
| 1 | Extract \`helperFunction\` from \`bigFunction\` | Tests still pass |
| 2 | Rename \`OldName\` → \`NewName\` | All references updated |
| 3 | Split \`large-file.ts\` into modules | Tests still pass |

## Safety Checks

- [ ] All existing tests pass
- [ ] No API changes (backward compatible)
- [ ] Git history preserved (use \`git mv\` for renames)
- [ ] Documentation updated

## Rollback Plan

How to revert if something goes wrong:
\`\`\`bash
git revert <commit-hash>
\`\`\`
`;
}

function orchestrationProtocol(): string {
  return `# Agent Orchestration Protocol

## Delegation Protocol

When delegating to a subagent during GS workflow:

1. **Task description** — what to do, not how
2. **Plan context** — which plan task(s) this relates to
3. **File paths** — exact files to work on
4. **Design tokens** — colors, fonts, spacing from loaded design system (if UI)
5. **Constraints** — phase restrictions, naming conventions
6. **Expected output** — what file(s) should be created/modified

## Subagent Status

| Status | Meaning | Action |
|--------|---------|--------|
| DONE | Task completed successfully | Mark task complete |
| DONE_WITH_CONCERNS | Done but has issues | Log concerns, reviewer checks |
| BLOCKED | Cannot proceed | Report to user, skip |
| NEEDS_CONTEXT | Missing information | Request from dispatcher |

## Context Isolation

Each subagent gets fresh context with ONLY:
- Specific task description
- Files it needs to read/write
- Relevant plan excerpt
- Loaded design tokens (if UI)

Never pass entire session context — degrades focus and wastes tokens.

## Anti-Patterns

- ❌ One agent doing everything (context overload)
- ❌ Re-doing completed work (check session state first)
- ❌ Subagent modifying unplanned files
- ❌ Not injecting design tokens for UI tasks
- ❌ Parallel agents sharing mutable state (race conditions)
`;
}
