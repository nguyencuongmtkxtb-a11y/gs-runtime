import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import type { DesignSystem, DesignSystemSummary } from "./types.js";
import { getDesignSystemsRoot } from "../shared/paths.js";

const DESIGN_SYSTEMS_ROOT = getDesignSystemsRoot();

const MAX_CACHE_SIZE = 10;
const systemCache = new Map<string, DesignSystem>();
let summaryCache: DesignSystemSummary[] | null = null;

function evictLRU(): void {
  if (systemCache.size < MAX_CACHE_SIZE) return;
  const firstKey = systemCache.keys().next().value;
  if (firstKey) systemCache.delete(firstKey);
}

function parseDesignMd(content: string, name: string, path: string): DesignSystem {
  const lines = content.split("\n");

  const titleLine = lines[0]?.replace(/^#\s+/, "").trim() ?? name;
  const displayName = titleLine.replace(/^Design System Inspired by\s+/, "");

  let category = "Other";
  let description = "";

  for (const line of lines) {
    if (line.startsWith("> Category:")) {
      category = line.replace(/^>\s*Category:\s*/, "").trim();
    } else if (line.startsWith("> ") && !description) {
      description = line.replace(/^>\s*/, "").trim();
      break;
    }
  }

  return {
    name: displayName,
    category: category || "Other",
    description: description || displayName,
    content,
    path,
  };
}

export function listDesignSystems(): DesignSystemSummary[] {
  if (summaryCache) return summaryCache;

  if (!existsSync(DESIGN_SYSTEMS_ROOT)) return [];

  const summaries: DesignSystemSummary[] = [];

  try {
    const entries = readdirSync(DESIGN_SYSTEMS_ROOT);

    for (const entry of entries) {
      const systemDir = join(DESIGN_SYSTEMS_ROOT, entry);
      if (!statSync(systemDir).isDirectory()) continue;

      const designMdPath = join(systemDir, "DESIGN.md");
      if (!existsSync(designMdPath)) continue;

      const content = readFileSync(designMdPath, "utf-8");
      const parsed = parseDesignMd(content, entry, designMdPath);

      summaries.push({
        name: parsed.name,
        category: parsed.category,
        description: parsed.description,
        path: designMdPath,
      });
    }
  } catch (err) {
    console.error("[gs] design-system-loader list failed:", err instanceof Error ? err.message : err);
    return [];
  }

  summaryCache = summaries;
  return summaries;
}

export function loadDesignSystem(name: string): DesignSystem | null {
  const cached = systemCache.get(name);
  if (cached) return cached;

  const summaries = listDesignSystems();
  const match = summaries.find(
    (s) =>
      s.name.toLowerCase() === name.toLowerCase() ||
      basename(s.path.replace(/[\\/]DESIGN\.md$/, "").replace(/\\/g, "/")).toLowerCase() === name.toLowerCase()
  );

  if (!match) return null;

  try {
    const content = readFileSync(match.path, "utf-8");
    const system = parseDesignMd(content, match.name, match.path);

    evictLRU();
    systemCache.set(system.name, system);

    return system;
  } catch {
    return null;
  }
}

export function searchDesignSystems(keyword: string): DesignSystemSummary[] {
  const lower = keyword.toLowerCase();
  const systems = listDesignSystems();

  return systems.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.category.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
  );
}
