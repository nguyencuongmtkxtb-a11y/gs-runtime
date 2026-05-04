# GS + Open Design Integration Design

## Overview

Tích hợp **open-design** (https://github.com/nexu-io/open-design) làm git submodule vào GS, kết hợp workflow enforcement của GS với design capabilities của open-design — biến GS thành all-in-one workflow tool cho cả dev + design.

## Integration Architecture

```
D:\GS\
├── integrations/
│   └── open-design/          ← git submodule
│       ├── skills/            ← 57 design skills (SKILL.md)
│       ├── design-systems/    ← 129 DESIGN.md files
│       ├── craft/             ← brand-agnostic craft rules
│       ├── prompt-templates/  ← media generation prompts
│       └── assets/            ← device frames, templates
├── skills/
│   ├── gs/                    ← existing GS workflow skill
│   └── od-bridge/             ← NEW: bridge skill
│       └── SKILL.md           ← maps open-design skills into GS
├── src/
│   ├── cli/                   ← existing CLI
│   ├── mcp/                   ← existing MCP server
│   ├── gitnexus/              ← existing GitNexus bridge
│   ├── shared/                ← existing shared utilities
│   └── design/                ← NEW: design integration module
│       ├── skill-loader.ts    ← load OD skills into GS context
│       ├── design-system-loader.ts ← load DESIGN.md into context
│       ├── prompt-composer.ts ← compose prompts with OD patterns
│       └── agent-detector.ts  ← detect available design agents
├── prompts/                   ← NEW: enhanced prompt templates
│   ├── design-discovery.md    ← inspired by OD discovery form
│   ├── design-critique.md     ← 5-dimension critique checklist
│   └── anti-slop.md           ← anti-AI-slop guidelines
└── .gs/
    └── design.md              ← this file
```

## Component Integration Plan

### 1. Skills (57 design skills)

**What to integrate**: Toàn bộ `integrations/open-design/skills/` dưới dạng read-only reference.

**How GS agents use them**:
- `src/design/skill-loader.ts` quét thư mục skills của open-design, parse SKILL.md frontmatter (`od:` fields), expose qua MCP tool `gs_list_design_skills`
- Agent gọi skill design qua `Skill` tool với path `integrations/open-design/skills/<name>/SKILL.md`
- OD-bridge skill (`skills/od-bridge/SKILL.md`) mô tả cách map giữa GS workflow phase và design skill phù hợp

**Skill categories mapped to GS phases**:
| GS Phase | Design Skills |
|----------|--------------|
| brainstorming | critique, wireframe-sketch, design-brief |
| planning | pm-spec, team-okrs, kanban-board |
| implementing | web-prototype, dashboard, mobile-app, saas-landing |
| reviewing | critique, tweaks |
| finishing | finance-report, meeting-notes, invoice |

### 2. Design Systems (129 DESIGN.md)

**What to integrate**: Toàn bộ `integrations/open-design/design-systems/`.

**How GS agents use them**:
- `src/design/design-system-loader.ts` load và cache DESIGN.md files
- MCP tool `gs_load_design_system <name>` để agent chọn hệ thống thiết kế
- Context injection: khi agent làm task UI/UX, design system được tự động inject vào system prompt
- Phân loại theo category (AI & LLM, Developer Tools, Fintech, Automotive, etc.)

### 3. Architecture Patterns

**a. Agent Detection & Multiplexing**
- `src/design/agent-detector.ts` scan PATH cho 13 CLI agents (claude, codex, opencode, gemini, cursor-agent, qwen, copilot, hermes, kimi, pi, kiro-cli, vibe-acp, devin)
- MCP tool `gs_detect_agents` → trả về danh sách agent khả dụng
- Cho phép user chọn agent khác nhau cho từng phase

**b. BYOK Proxy (optional future)**
- Thêm endpoint `/api/proxy/stream` vào MCP server
- Cho phép dùng OpenAI-compatible models thay vì CLI agents
- SSRF protection (block loopback, link-local, RFC1918)

**c. Prompt Stack Enhancement**
- `prompts/design-discovery.md`: Form khám phá yêu cầu thiết kế (surface, audience, tone, brand, scale)
- `prompts/design-critique.md`: 5-dimensional critique (Philosophy, Hierarchy, Detail, Function, Innovation)
- `prompts/anti-slop.md`: Anti-AI-slop checklist

### 4. Prompt Engineering

**Discovery Protocol** (từ `huashu-design` + OD):
- Rule 1: mọi design brief bắt đầu bằng `<question-form>` thay vì code
- Junior-Designer mode: batch câu hỏi upfront, show wireframe sớm, cho user redirect rẻ

**Critique Protocol**:
- 5 dimensions: Philosophy (triết lý), Hierarchy (phân cấp), Detail (chi tiết), Function (chức năng), Innovation (đổi mới)
- Mỗi dimension chấm điểm 1-10, kèm lý do

**Anti-Slop Checklist**:
- Cấm dùng generic placeholder text
- Cấm dùng màu sắc không từ design system
- Cấm dùng font system default không curated
- Phải có brand consistency

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Thêm open-design làm git submodule: `git submodule add https://github.com/nexu-io/open-design.git integrations/open-design`
- [ ] Tạo `skills/od-bridge/SKILL.md` — bridge skill mô tả integration
- [ ] Tạo `src/design/` module skeleton
- [ ] Cập nhật `package.json` với dependencies mới (nếu cần)

### Phase 2: Skill & Design System Loader (Week 2)
- [ ] Implement `skill-loader.ts`: quét + parse OD skills, expose qua MCP
- [ ] Implement `design-system-loader.ts`: load + cache DESIGN.md, context injection
- [ ] MCP tools: `gs_list_design_skills`, `gs_load_design_system`, `gs_search_design_systems`
- [ ] Test: verify skills loadable qua GS skill system

### Phase 3: Agent Detection (Week 3)
- [ ] Implement `agent-detector.ts`: PATH scan + capability detection
- [ ] MCP tool: `gs_detect_agents`
- [ ] CLI command: `gs agents --list`
- [ ] Integration: cho phép chọn agent trong `gs brainstorm` flow

### Phase 4: Prompt Enhancement (Week 4)
- [ ] Viết `prompts/design-discovery.md`
- [ ] Viết `prompts/design-critique.md`
- [ ] Viết `prompts/anti-slop.md`
- [ ] `prompt-composer.ts`: compose system prompt với các template
- [ ] Test: verify prompt stack hoạt động với các agent

### Phase 5: BYOK Proxy (Week 5 - Optional)
- [ ] Thêm proxy endpoint vào MCP server
- [ ] SSRF protection
- [ ] Test với OpenAI-compatible providers

## Key Design Decisions

1. **Submodule, không copy**: Giữ open-design update độc lập, tránh fork drift
2. **Read-only reference**: OD skills dùng làm context/reference, không modify
3. **Bridge pattern**: OD-bridge skill làm adapter giữa GS workflow và OD design capabilities
4. **MCP-first**: Tất cả integration expose qua MCP tools cho agent truy cập
5. **Gradual roll-out**: Phase 1-2 là core, phase 3-5 là enhancement

## Decisions Made

- ✅ **Tích hợp cả web UI** (Next.js 16 App Router + React 18 từ open-design)
- ✅ **Nâng GS lên Node 24** + pnpm 10.33 để tương thích hoàn toàn
- ✅ **Phase 1-4**: Skip BYOK proxy, tập trung vào core integration
- ⬜ Media generation (gpt-image-2, Seedance, HyperFrames) — future
- ⬜ GitNexus indexing — cần trước khi implementation

## Updated Architecture (với Web UI)

```
D:\GS\
├── integrations/
│   └── open-design/          ← git submodule (toàn bộ repo)
├── apps/                     ← NEW: từ open-design
│   ├── web/                  ← Next.js 16 App Router + React 18
│   ├── daemon/               ← Express + SQLite daemon
│   └── desktop/              ← Electron shell (optional)
├── packages/                 ← NEW: từ open-design
│   ├── contracts/            ← shared app contracts
│   ├── sidecar-proto/        ← sidecar protocol
│   ├── sidecar/              ← sidecar runtime
│   └── platform/             ← OS primitives
├── tools/                    ← NEW: từ open-design
│   ├── dev/                  ← lifecycle control plane
│   └── pack/                 ← build/pack control plane
├── skills/
│   ├── gs/                   ← existing GS skill
│   └── od-bridge/            ← NEW: bridge skill
├── src/                      ← existing GS source
│   ├── cli/                  ← GS CLI (mở rộng)
│   ├── mcp/                  ← GS MCP server (mở rộng)
│   ├── gitnexus/             ← GitNexus bridge
│   ├── shared/               ← shared utilities
│   └── design/               ← NEW: design integration
├── e2e/                      ← Playwright + Vitest
└── .gs/
    └── design.md             ← this file
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Thêm open-design làm git submodule
- [ ] Nâng cấp Node lên 24 + cài pnpm 10.33
- [ ] Cấu trúc lại GS repo để tích hợp apps/packages/tools từ OD
- [ ] Merge package.json, tsconfig, pnpm-workspace.yaml
- [ ] Tạo `skills/od-bridge/SKILL.md`
- [ ] Cập nhật AGENTS.md phản ánh kiến trúc mới

### Phase 2: Skill & Design System Loader (Week 2-3)
- [ ] Implement `src/design/skill-loader.ts`
- [ ] Implement `src/design/design-system-loader.ts`
- [ ] MCP tools: `gs_list_design_skills`, `gs_load_design_system`
- [ ] Test: skills loadable qua GS agent
- [ ] Web UI: hiển thị skill picker + design system dropdown

### Phase 3: Agent Detection & Web UI (Week 3-4)
- [ ] Implement `src/design/agent-detector.ts`
- [ ] MCP tool: `gs_detect_agents`
- [ ] CLI: `gs agents --list`
- [ ] Web UI: model picker hiển thị detected agents
- [ ] Daemon: spawn agents cho design tasks

### Phase 4: Prompt Enhancement (Week 4-5)
- [ ] Viết `prompts/design-discovery.md`
- [ ] Viết `prompts/design-critique.md`
- [ ] Viết `prompts/anti-slop.md`
- [ ] `src/design/prompt-composer.ts`
- [ ] Test: prompt stack hoạt động với agent
