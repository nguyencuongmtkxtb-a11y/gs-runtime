import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Resolve the GS installation root directory.
 *
 * Strategy (in order):
 * 1. GS_ROOT env var (explicit override)
 * 2. Relative to this compiled file (dist/shared/paths.js → ../../)
 * 3. Fallback to process.cwd() (degraded mode)
 */
export function getGSInstallRoot(): string {
  // 1. Explicit env override
  if (process.env.GS_ROOT && existsSync(process.env.GS_ROOT)) {
    return process.env.GS_ROOT;
  }

  // 2. Resolve from compiled file location: dist/shared/paths.js → GS root
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const distShared = dirname(thisFile); // dist/shared/
    const distDir = dirname(distShared); // dist/
    const gsRoot = dirname(distDir); // GS root
    if (existsSync(join(gsRoot, "package.json"))) {
      return gsRoot;
    }
  } catch {
    // import.meta.url may not be available in all contexts
  }

  // 3. Fallback — degraded mode
  return process.cwd();
}

/**
 * Resolve the integrations/open-design directory.
 * Falls back to project cwd if submodule exists there instead.
 */
export function getOpenDesignRoot(): string {
  const gsRoot = getGSInstallRoot();
  const odFromGS = join(gsRoot, "integrations", "open-design");
  if (existsSync(odFromGS)) {
    return odFromGS;
  }

  // Fallback: check project cwd (in case open-design is vendored in the project)
  const odFromCwd = join(process.cwd(), "integrations", "open-design");
  if (existsSync(odFromCwd)) {
    return odFromCwd;
  }

  // Return the GS-based path anyway (caller will handle missing gracefully)
  return odFromGS;
}

/**
 * Resolve the design-systems directory inside open-design.
 */
export function getDesignSystemsRoot(): string {
  return join(getOpenDesignRoot(), "design-systems");
}

/**
 * Resolve the skills directory inside open-design.
 */
export function getDesignSkillsRoot(): string {
  return join(getOpenDesignRoot(), "skills");
}
