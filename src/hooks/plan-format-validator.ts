import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PlanFormatResult {
  valid: boolean;
  file: string;
  issues: string[];
  warnings: string[];
}

export function validatePlanFormat(root: string, filePath: string): PlanFormatResult {
  const normalized = filePath.replace(/\\/g, "/");
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!normalized.includes("plan.md") && !normalized.includes(".gs/plan")) {
    return { valid: true, file: filePath, issues: [], warnings: [] };
  }

  const fullPath = join(root, normalized.replace(/^\//, ""));
  if (!existsSync(fullPath)) {
    return { valid: true, file: filePath, issues: [], warnings: [] };
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    let hasHeader = false;
    let hasTasks = false;
    let hasAcceptance = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("# ") || line.startsWith("## ")) hasHeader = true;
      if (line.match(/^\|.*\|.*\|/)) hasTasks = true;
      if (line.includes("acceptance") || line.includes("Acceptance")) hasAcceptance = true;

      if (line.includes("[")) {
        const links = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
        if (links) {
          for (const link of links) {
            const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (match) {
              const text = match[1];
              const url = match[2];
              if (text === url || text === "link" || text === "here" || text === "file") {
                warnings.push(`Line ${i + 1}: Non-descriptive link text "[${text}](${url})". Use human-readable text describing what the link points to.`);
              }
            }
          }
        }
      }

      const statusMatch = line.match(/\|\s*(⬜|✅|🔄|❌)\s*(?=\|)/);
      if (statusMatch) {
        warnings.push(`Line ${i + 1}: Direct status edit detected. Use CLI commands (gs_complete_task) instead of editing status characters in the plan file.`);
      }
    }

    if (!hasHeader) {
      issues.push("Plan file has no header. Must start with # or ## heading.");
    }
    if (!hasTasks) {
      warnings.push("No task tables found. Consider using the feature plan template format.");
    }
    if (!hasAcceptance) {
      warnings.push("No acceptance criteria section found. Each task should have acceptance criteria.");
    }

    return {
      valid: issues.length === 0,
      file: filePath,
      issues,
      warnings,
    };
  } catch {
    return { valid: false, file: filePath, issues: ["Cannot read plan file"], warnings: [] };
  }
}
