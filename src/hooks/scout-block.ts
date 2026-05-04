import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const GITIGNORE_SPEC = ".gsignore";
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  ".next/",
  "coverage/",
  ".venv/",
  "__pycache__/",
  ".cache/",
  ".gs/",
];

export interface ScoutCheckResult {
  blocked: boolean;
  path: string;
  reason: string;
}

function loadIgnorePatterns(root: string): string[] {
  const ignorePath = join(root, GITIGNORE_SPEC);
  if (!existsSync(ignorePath)) return DEFAULT_IGNORE_PATTERNS;
  try {
    const raw = readFileSync(ignorePath, "utf-8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } catch {
    return DEFAULT_IGNORE_PATTERNS;
  }
}

export function checkScout(root: string, filePath: string): ScoutCheckResult {
  const patterns = loadIgnorePatterns(root);
  const normalized = filePath.replace(/\\/g, "/");

  for (const pattern of patterns) {
    const clean = pattern.replace(/\/$/, "");
    if (normalized.startsWith(clean + "/") || normalized === clean || normalized.includes("/" + clean + "/")) {
      return {
        blocked: true,
        path: filePath,
        reason: `Path "${filePath}" is in blocked directory "${pattern}". High-noise, low-value content.`,
      };
    }
  }

  return { blocked: false, path: filePath, reason: "" };
}

export function generateScoutIgnore(root: string): string {
  return `# GS Scout Ignore — directories blocked from agent access
# These are high-noise, low-value directories.
# Add project-specific patterns below.

# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
.next/
out/

# Version control internals
.git/

# Coverage
coverage/
.nyc_output/

# Python
__pycache__/
.venv/
*.pyc

# GS Runtime internals
.gs/

# Cache
.cache/
.turbo/
`;
}
