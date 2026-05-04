import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateScoutIgnore } from "../hooks/scout-block.js";
import {
  editorconfig,
  gitignore,
  readme,
  claudeMd,
  projectOverview,
  codeStandards,
  systemArchitecture,
  projectRoadmap,
  deploymentGuide,
  featurePlanTemplate,
  bugFixTemplate,
  refactorTemplate,
  orchestrationProtocol,
} from "./scaffold-templates.js";

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
