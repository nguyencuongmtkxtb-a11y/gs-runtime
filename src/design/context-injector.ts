import type { DesignSystem } from "./types.js";
import { loadDesignSystem } from "./design-system-loader.js";

export function buildDesignContext(designSystemName?: string): string {
  if (!designSystemName) {
    return `## Design Integration (Open Design)
Design capabilities are available but no active design system is selected.
Use gs_list_design_skills to explore available design skills.
Use gs_load_design_system to select a design system.
Use gs_compose_design_prompt to generate a full design prompt.`;
  }

  const system = loadDesignSystem(designSystemName);
  if (!system) {
    return `## Design Integration
Design system "${designSystemName}" not found.
Use gs_search_design_systems to find available systems.`;
  }

  const tokens = extractDesignTokens(system);

  return `## Active Design System: ${system.name}
**Category**: ${system.category}
**Description**: ${system.description}

### Design Tokens
${tokens}

### How to Use
1. Apply these tokens to ALL design decisions
2. Do not introduce colors or fonts outside this system
3. Follow the spacing scale for consistent layouts
4. Use the component patterns as design references

Call gs_load_design_system with a different name to switch systems.`;
}

function extractDesignTokens(system: DesignSystem): string {
  const content = system.content;
  const tokens: string[] = [];

  const colorMatch = content.match(/## \d+\. Color Palette\s*\n([\s\S]*?)(?=\n## \d+\.|$)/);
  if (colorMatch) {
    const hexes = colorMatch[1].match(/#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsl\([^)]+\)|oklch\([^)]+\)/g);
    if (hexes && hexes.length > 0) {
      tokens.push(`**Primary Colors**: ${hexes.slice(0, 5).join(", ")}`);
    }
  }

  const typoMatch = content.match(/## \d+\. Typography\s*\n([\s\S]*?)(?=\n## \d+\.|$)/);
  if (typoMatch) {
    const fonts = typoMatch[1].match(/(?:'[^']+'|"[^"]+"|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(?=\s*(?:as|for|is|,|\.|at|\n|$))/g);
    if (fonts && fonts.length > 0) {
      const unique = [...new Set(fonts.filter((f) => f.length > 3))];
      tokens.push(`**Font Stack**: ${unique.slice(0, 4).join(", ")}`);
    }
  }

  const spacingMatch = content.match(/## \d+\. Spacing\s*\n([\s\S]*?)(?=\n## \d+\.|$)/);
  if (spacingMatch) {
    const numbers = spacingMatch[1].match(/\d+px|\d+rem|\d+em/g);
    if (numbers && numbers.length > 0) {
      tokens.push(`**Spacing Scale**: ${numbers.slice(0, 5).join(", ")}`);
    }
  }

  if (tokens.length === 0) {
    return "Use the design system content directly for token reference.";
  }

  return tokens.join("\n");
}
