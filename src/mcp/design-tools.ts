import { scanSkills, listSkillsByScenario } from "../design/skill-loader.js";
import { loadDesignSystem, listDesignSystems, searchDesignSystems } from "../design/design-system-loader.js";
import { detectAgents } from "../design/agent-detector.js";
import { composeDesignPrompt } from "../design/prompt-composer.js";
import type { ComposeParams } from "../design/types.js";

export const DESIGN_TOOL_DEFINITIONS = [
  {
    name: "gs_list_design_skills",
    description: "List all available Open Design skills (57) grouped by scenario. Use to discover design capabilities for the current task.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "gs_load_design_system",
    description: "Load a specific design system's DESIGN.md content by name (e.g., 'linear-app', 'stripe', 'apple'). Returns full design tokens and guidelines.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Design system name (e.g., 'linear-app', 'stripe', 'vercel', 'apple')" },
      },
      required: ["name"],
    },
  },
  {
    name: "gs_search_design_systems",
    description: "Search design systems by keyword (name, category, or description). Returns matching systems with metadata.",
    inputSchema: {
      type: "object" as const,
      properties: {
        keyword: { type: "string", description: "Search keyword to match against name, category, or description" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "gs_detect_agents",
    description: "Detect available CLI coding agents on the user's PATH. Returns list of available and unavailable agents with protocol info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "gs_compose_design_prompt",
    description: "Compose a full design prompt with active design system, skill, discovery/critique directives, and anti-slop checklist.",
    inputSchema: {
      type: "object" as const,
      properties: {
        skillName: { type: "string", description: "Name of the design skill to use (optional)" },
        designSystemName: { type: "string", description: "Name of the design system to apply (optional)" },
        discoveryMode: { type: "boolean", description: "Include discovery question form directives" },
        critiqueMode: { type: "boolean", description: "Include 5-dimension critique directives" },
        fidelity: { type: "string", enum: ["low", "medium", "high"], description: "Design fidelity level" },
        speakerNotes: { type: "boolean", description: "Include speaker notes (for decks)" },
        animations: { type: "boolean", description: "Allow animations" },
        projectDescription: { type: "string", description: "Project brief or description" },
      },
      required: [],
    },
  },
];

export async function handleDesignTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "gs_list_design_skills": {
      const grouped = listSkillsByScenario();
      const skills = scanSkills();
      return JSON.stringify({
        total: skills.length,
        scenarios: Object.keys(grouped).length,
        skillsByScenario: grouped,
      }, null, 2);
    }

    case "gs_load_design_system": {
      const name = args.name as string;
      if (!name) {
        return JSON.stringify({ error: "Missing required parameter: name" }, null, 2);
      }
      const system = loadDesignSystem(name);
      if (!system) {
        const available = listDesignSystems().map((s) => s.name).slice(0, 10);
        return JSON.stringify({
          error: `Design system "${name}" not found.`,
          suggestions: available,
          total: listDesignSystems().length,
        }, null, 2);
      }
      return JSON.stringify({
        name: system.name,
        category: system.category,
        description: system.description,
        content: system.content,
      }, null, 2);
    }

    case "gs_search_design_systems": {
      const keyword = args.keyword as string;
      if (!keyword) {
        return JSON.stringify({ error: "Missing required parameter: keyword" }, null, 2);
      }
      const results = searchDesignSystems(keyword);
      return JSON.stringify({
        keyword,
        count: results.length,
        results: results.map((s) => ({
          name: s.name,
          category: s.category,
          description: s.description,
        })),
      }, null, 2);
    }

    case "gs_detect_agents": {
      const agents = detectAgents();
      return JSON.stringify({
        total: agents.length,
        available: agents.filter((a) => a.available).length,
        agents: agents.map((a) => ({
          name: a.name,
          displayName: a.displayName,
          protocol: a.protocol,
          available: a.available,
          path: a.path,
        })),
      }, null, 2);
    }

    case "gs_compose_design_prompt": {
      const params: ComposeParams = {
        skillName: args.skillName as string | undefined,
        designSystemName: args.designSystemName as string | undefined,
        discoveryMode: args.discoveryMode as boolean | undefined,
        critiqueMode: args.critiqueMode as boolean | undefined,
        fidelity: args.fidelity as ComposeParams["fidelity"],
        speakerNotes: args.speakerNotes as boolean | undefined,
        animations: args.animations as boolean | undefined,
        projectDescription: args.projectDescription as string | undefined,
      };
      const prompt = composeDesignPrompt(params);
      return JSON.stringify({
        params,
        promptLength: prompt.length,
        prompt,
      }, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown design tool: ${name}` }, null, 2);
  }
}
