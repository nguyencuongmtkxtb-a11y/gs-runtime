---
name: od-bridge
description: MANDATORY Open Design bridge for GS — integrates 59 design skills + 137 design systems into the GS workflow. Use for ANY UI/frontend/visual task in every GS phase.
mode: prototype
scenario: design
---

# OD Bridge — Open Design Integration for GS (MANDATORY)

GS now includes Open Design as a HARD REQUIREMENT — on par with `gs_check_file` and `gs_pre_commit`. For any task involving UI, frontend, visuals, presentations, or client-facing output, you MUST use the design tools below. No exceptions.

## MANDATORY Usage by Phase

| Phase | Non-negotiable Action |
|-------|----------------------|
| brainstorming | `gs_list_design_skills` → `gs_search_design_systems` → `gs_compose_design_prompt` (discovery) |
| planning | `gs_load_design_system` → extract tokens → reference in every UI task |
| implementing | `gs_compose_design_prompt` → use ONLY design system tokens — ZERO ad-hoc CSS |
| reviewing | `gs_compose_design_prompt` (critique mode) → verify colors/fonts/spacing match DESIGN.md |

## CRITICAL Design Rules (ZERO exceptions)

1. **NEVER write a single line of CSS without first loading a design system**
2. **NEVER use ad-hoc hex colors, font sizes, or spacing — ONLY design system tokens**
3. **NEVER use "Lorem ipsum" — all copy must be real and contextual**
4. **All design output is verified against the loaded DESIGN.md in the review phase**

## Design Skills (59 across 12 scenarios)

Skills live in `integrations/open-design/skills/`. Key skills by GS phase:

### brainstorming
`wireframe-sketch` (hand-drawn wireframes), `design-brief` (design requirements), `image-poster` (visual concepts)

### planning
`pm-spec` (PRD writing), `team-okrs` (OKR tracking), `kanban-board` (task visualization)

### implementing
`web-prototype` (landing pages, full websites), `dashboard` (data dashboards), `mobile-app` (mobile UI), `saas-landing` (SaaS marketing pages), `pricing-page` (pricing tiers), `docs-page` (documentation sites), `blog-post` (blog layouts), `email-marketing` (email templates), `mobile-onboarding` (app onboarding flows)

### reviewing
`critique` (5-dimension design review: philosophy, hierarchy, detail, function, innovation), `tweaks` (live theme adjustment panel)

### finishing
`finance-report`, `meeting-notes`, `invoice`, `eng-runbook`, `hr-onboarding`

### Deck/Presentation mode (28 exotic themes)
`html-ppt` (general), `html-ppt-pitch-deck`, `html-ppt-tech-sharing`, `html-ppt-product-launch`, `html-ppt-weekly-report`, `html-ppt-xhs-post`, `html-ppt-course-module`, `html-ppt-presenter-mode`, `html-ppt-dir-key-nav-minimal`, `html-ppt-xhs-pastel-card`, `html-ppt-xhs-white-editorial`, `html-ppt-graphify-dark-graph`, `html-ppt-knowledge-arch-blueprint`, `html-ppt-hermes-cyber-terminal`, `html-ppt-obsidian-claude-gradient`, `html-ppt-testing-safety-alert`, `guizang-ppt` (magazine-style), `simple-deck`, `replit-deck`, `weekly-update`

## Design Systems (137 across 19 categories)

Systems live in `integrations/open-design/design-systems/`. Top systems by category:

- **AI & LLM**: claude, openai, cohere, mistral-ai, elevenlabs, minimax, ollama, replicate, runwayml, together-ai, voltagent, x-ai, opencode-ai
- **Developer Tools**: vercel, cursor, expo, lovable, raycast, superhuman, warp
- **Productivity**: linear-app, notion, cal, intercom, mintlify, resend, zapier
- **Fintech**: stripe, binance, coinbase, kraken, mastercard, revolut, wise
- **Design**: figma, framer, airtable, clay, miro, webflow
- **Consumer**: apple, nvidia, spacex, spotify, uber, pinterest, playstation, ibm, meta
- **E-Commerce**: shopify, nike, airbnb, starbucks
- **Backend**: supabase, sentry, mongodb, clickhouse, hashicorp, posthog, sanity
- **Automotive**: tesla, bmw, ferrari, lamborghini, bugatti
- **Media**: wired, theverge, xiaohongshu

## MCP Design Tools

| Tool | Purpose | Required in Phase |
|------|---------|-------------------|
| `gs_list_design_skills` | List 59 skills by scenario | brainstorming |
| `gs_search_design_systems` | Search 137 systems by keyword | brainstorming |
| `gs_coad_design_system` | Load full DESIGN.md with tokens | planning |
| `gs_detect_agents` | Detect CLI agents on PATH | any (recommended) |
| `gs_compose_design_prompt` | Compose prompt with system + skill + anti-slop | all phases |

## Anti-Slop Checklist (always apply)

- [ ] NO generic placeholder text ("Lorem ipsum", "Content goes here")
- [ ] ALL colors come from the loaded design system (no ad-hoc hex)
- [ ] ALL fonts are from the curated font stack (no system defaults)
- [ ] Brand consistency maintained across every element
- [ ] All copy is contextual and relevant to the brief
- [ ] No generic stock photo descriptions
- [ ] Every element has a clear purpose — no decorative-only elements
