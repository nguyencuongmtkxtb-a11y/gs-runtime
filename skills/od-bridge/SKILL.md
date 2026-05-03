---
name: od-bridge
description: Bridge between GS workflow phases and Open Design skills/systems
mode: prototype
scenario: design
---

# OD Bridge — Open Design Integration for GS

Maps GS workflow phases to Open Design capabilities. Use when UI/UX design tasks are needed during any GS phase.

## Available Design Skills (57)

Skills are in `integrations/open-design/skills/`. Load a skill by reading its SKILL.md.

### By GS Phase

| GS Phase | Recommended Skills |
|----------|-------------------|
| brainstorming | `wireframe-sketch`, `design-brief`, `critique` |
| planning | `pm-spec`, `team-okrs`, `kanban-board` |
| implementing | `web-prototype`, `dashboard`, `mobile-app`, `saas-landing`, `mobile-onboarding`, `pricing-page`, `docs-page`, `blog-post`, `email-marketing` |
| reviewing | `critique`, `tweaks` |
| finishing | `finance-report`, `meeting-notes`, `invoice`, `eng-runbook`, `hr-onboarding` |

### By Scenario

- **design**: web-prototype, mobile-app, mobile-onboarding, wireframe-sketch, critique, tweaks, design-brief
- **marketing**: saas-landing, blog-post, email-marketing, social-carousel, magazine-poster, motion-frames, sprite-animation, digital-eguide
- **operation**: dashboard, meeting-notes, kanban-board
- **engineering**: docs-page, eng-runbook
- **product**: pm-spec, team-okrs
- **finance**: finance-report, invoice
- **hr**: hr-onboarding
- **sale**: pricing-page
- **personal**: gamified-app, dating-web, hatch-pet

### Deck Mode (presentations)
`guizang-ppt` (default), `simple-deck`, `replit-deck`, `weekly-update`

## Available Design Systems (129)

Design systems are in `integrations/open-design/design-systems/`. Each is a `DESIGN.md` file.

### MCP Tools
- `gs_list_design_skills` — list all 57 skills grouped by scenario
- `gs_load_design_system <name>` — load a specific design system
- `gs_search_design_systems <keyword>` — search by name/category
- `gs_detect_agents` — detect available CLI agents
- `gs_compose_design_prompt <params>` — compose design prompt with active system + skill

### How to Use

1. **Start design task**: Call `gs_list_design_skills` to see available skills
2. **Pick a design system**: Call `gs_load_design_system "linear-app"` (or any brand)
3. **Load skill**: Use the Skill tool with path `integrations/open-design/skills/<name>/SKILL.md`
4. **Compose prompt**: Call `gs_compose_design_prompt` with skill + design system + project metadata
5. **Generate artifact**: Agent produces HTML/CSS artifact using the loaded context

### Design Systems by Category

- **AI & LLM**: claude, cohere, elevenlabs, minimax, mistral-ai, ollama, openai, opencode-ai, replicate, runwayml, together-ai, voltagent, x-ai
- **Developer Tools**: cursor, expo, lovable, raycast, superhuman, vercel, warp
- **Productivity**: cal, intercom, linear-app, mintlify, notion, resend, zapier
- **Backend & Data**: clickhouse, composio, hashicorp, mongodb, posthog, sanity, sentry, supabase
- **Design & Creative**: airtable, clay, figma, framer, miro, webflow
- **Fintech**: binance, coinbase, kraken, mastercard, revolut, stripe, wise
- **E-Commerce**: airbnb, meta, nike, shopify, starbucks
- **Consumer**: apple, ibm, nvidia, pinterest, playstation, spacex, spotify, theverge, uber, vodafone, wired, xiaohongshu
- **Automotive**: bmw, bugatti, ferrari, lamborghini, renault, tesla

### Design Systems by Style
`default` (Neutral Modern), `warm-editorial` (Warm Editorial), `kami` (Editorial paper), `brutalism`, `neobrutalism`, `glassmorphism`, `claymorphism`, `neumorphism`, `minimal`, `modern`, `corporate`, `elegant`, `luxury`, `bold`, `flat`, `material`, `mono`, `gradient`, `neon`, `dithered`, `doodle`, `futuristic`, `artistic`, `fantasy`, `cosmic`, `dramatic`, `expressive`, `friendly`, `clean`, `creative`, `colorful`, `energetic`, `refined`, `contemporary`, `professional`, `enterprise`, `editorial`, `publication`, `perspective`, `bento`, `levels`

### Anti-Slop Checklist (always apply)
- No generic placeholder text
- Colors must come from active design system
- Fonts must be from curated stack
- Brand consistency across all elements
- All copy contextual and relevant
