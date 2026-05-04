import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { DesignSkill } from "./types.js";
import { getDesignSkillsRoot } from "../shared/paths.js";

const SKILLS_ROOT = getDesignSkillsRoot();

const skillCache = new Map<string, DesignSkill>();

function parseFrontmatter(content: string): Record<string, unknown> {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let inOdBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx <= 0) continue;

    const key = trimmed.substring(0, colonIdx).trim();
    const rest = trimmed.substring(colonIdx + 1).trim();

    if (rest === "|") {
      result[key] = "";
      continue;
    }

    if (key === "od") {
      if (rest === "") {
        inOdBlock = true;
        result[key] = {};
      }
      continue;
    }

    if (inOdBlock && line.startsWith("  ")) {
      const odObj = result["od"] as Record<string, unknown>;
      if (odObj) {
        odObj[key] = rest || key;
      }
    } else {
      inOdBlock = false;
      if (rest !== "") {
        result[key] = rest;
      }
    }
  }

  return result;
}

function parseOdField(frontmatter: Record<string, unknown>): Partial<DesignSkill> {
  const od = frontmatter.od as Record<string, unknown> | undefined;
  if (!od) return {};

  return {
    name: frontmatter.name as string ?? "",
    description: (frontmatter.description as string) ?? "",
    mode: (od.mode as DesignSkill["mode"]) ?? "prototype",
    platform: (od.platform as DesignSkill["platform"]) ?? "desktop",
    scenario: (od.scenario as string) ?? "design",
    featured: (od.featured as boolean) ?? false,
    fidelity: (od.fidelity as DesignSkill["fidelity"]) ?? "medium",
    preview: od.preview as DesignSkill["preview"] | undefined,
    speaker_notes: (od.speaker_notes as boolean) ?? false,
    animations: (od.animations as boolean) ?? false,
    example_prompt: (od.example_prompt as string) ?? undefined,
  };
}

export function scanSkills(): DesignSkill[] {
  const root = SKILLS_ROOT;
  if (!existsSync(root)) return [];

  if (skillCache.size > 0) {
    return Array.from(skillCache.values());
  }

  const skills: DesignSkill[] = [];

  try {
    const entries = readdirSync(root);

    for (const entry of entries) {
      const skillDir = join(root, entry);
      if (!statSync(skillDir).isDirectory()) continue;

      const skillMdPath = join(skillDir, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;

      const content = readFileSync(skillMdPath, "utf-8");
      const frontmatter = parseFrontmatter(content);
      const parsed = parseOdField(frontmatter);

      const skill: DesignSkill = {
        name: parsed.name ?? entry,
        path: skillMdPath,
        mode: parsed.mode ?? "prototype",
        platform: parsed.platform ?? "desktop",
        scenario: parsed.scenario ?? "design",
        description: parsed.description ?? "",
        featured: parsed.featured ?? false,
        fidelity: parsed.fidelity ?? "medium",
        preview: parsed.preview,
        speaker_notes: parsed.speaker_notes,
        animations: parsed.animations,
        example_prompt: parsed.example_prompt,
      };

      skills.push(skill);
      skillCache.set(skill.name, skill);
    }
  } catch (err) {
    console.error("[gs] skill-loader scan failed:", err instanceof Error ? err.message : err);
    return [];
  }

  return skills;
}

export function listSkillsByScenario(): Record<string, DesignSkill[]> {
  const skills = scanSkills();
  const grouped: Record<string, DesignSkill[]> = {};

  for (const skill of skills) {
    const scenario = skill.scenario;
    if (!grouped[scenario]) {
      grouped[scenario] = [];
    }
    grouped[scenario].push(skill);
  }

  return grouped;
}

export function getSkillByName(name: string): DesignSkill | null {
  const skills = scanSkills();
  return skills.find((s) => s.name === name) ?? null;
}
