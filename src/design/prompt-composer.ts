import { join } from "node:path";
import type { ComposeParams } from "./types.js";
import { loadDesignSystem } from "./design-system-loader.js";
import { getSkillByName } from "./skill-loader.js";
import { getGSInstallRoot } from "../shared/paths.js";

const PROMPTS_DIR = join(getGSInstallRoot(), "prompts");

function getIdentityCharter(): string {
  return `You are a design engineer. You produce production-quality HTML/CSS artifacts
that follow the active design system's tokens precisely. You do not invent colors,
fonts, or spacing — you use what the design system provides.

CRITICAL RULES:
1. Every design begins with understanding the brief, not writing code.
2. Use ONLY colors, fonts, and spacing from the active design system.
3. Never use "Lorem ipsum" or generic placeholder text.
4. Always maintain brand consistency across all elements.
5. Critique your own output before presenting it.

You are operating inside the GS (Superpowers + GitNexus) workflow. Follow the
current phase's instructions and produce design artifacts as requested.`;
}

function getAntiSlopChecklist(): string {
  return `## Anti-AI-Slop Checklist (CRITICAL)
- [] NO generic placeholder text ("Lorem ipsum", "Content goes here", "Sample text")
- [] ALL colors come from the active design system (no ad-hoc hex values)
- [] ALL fonts are from the curated font stack (no system defaults)
- [] Brand consistency maintained across every element
- [] All copy is contextual and relevant to the brief
- [] No generic stock photo descriptions — use real, specific imagery descriptions
- [] Every element has a clear purpose — no decorative-only elements`;
}

function getDiscoveryDirectives(): string {
  return `## Discovery Protocol

Before generating any code, you MUST produce a <question-form id="discovery">
that locks in the following before the first pixel is drawn:

1. **Surface** — What platform? (desktop, mobile, tablet)
2. **Audience** — Who will use/view this?
3. **Tone** — What emotion/mood should it convey?
4. **Brand context** — Any existing brand colors, fonts, or guidelines?
5. **Scale** — Single page, multi-section, or multi-screen?
6. **Constraints** — Any technical or content constraints?

This is the Junior-Designer mode: batch all questions upfront, show something
visible early (even a wireframe with grey blocks), and let the user redirect
cheaply. The cost of a wrong direction is one chat round, not one finished design.`;
}

function getCritiqueDirectives(): string {
  return `## 5-Dimensional Design Critique

After producing a design, critique your own output on these 5 dimensions:

| Dimension | Focus | Score (1-10) |
|-----------|-------|-------------|
| **Philosophy** | Design philosophy coherence, brand alignment | |
| **Hierarchy** | Visual hierarchy, information architecture | |
| **Detail** | Typography precision, spacing consistency | |
| **Function** | Usability, interactivity, UX flow | |
| **Innovation** | Originality, creative spark, distinctiveness | |

For each dimension, provide a reason for the score. Total must be >= 35/50
to be acceptable. If below, identify specific improvements needed.`;
}

export function composeDesignPrompt(params: ComposeParams): string {
  const sections: string[] = [];

  sections.push(getIdentityCharter());

  if (params.designSystemName) {
    const system = loadDesignSystem(params.designSystemName);
    if (system) {
      sections.push(`\n## Active Design System: ${system.name}\n\n${system.content}`);
    }
  }

  if (params.skillName) {
    const skill = getSkillByName(params.skillName);
    if (skill) {
      sections.push(`\n## Active Skill: ${skill.name} (${skill.mode}/${skill.platform})\n${skill.description}`);
    }
  }

  if (params.discoveryMode) {
    sections.push(getDiscoveryDirectives());
  }

  if (params.critiqueMode) {
    sections.push(getCritiqueDirectives());
  }

  sections.push(getAntiSlopChecklist());

  if (params.projectDescription) {
    sections.push(`\n## Project Brief\n${params.projectDescription}`);
  }

  if (params.fidelity) {
    sections.push(`\n## Fidelity Level: ${params.fidelity}`);
  }

  if (params.speakerNotes !== undefined) {
    sections.push(`\n## Speaker Notes: ${params.speakerNotes ? "Enabled" : "Disabled"}`);
  }

  if (params.animations !== undefined) {
    sections.push(`\n## Animations: ${params.animations ? "Enabled" : "Disabled"}`);
  }

  return sections.join("\n");
}
