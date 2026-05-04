import { describe, it, expect } from "vitest";
import { getGSInstallRoot, getOpenDesignRoot, getDesignSystemsRoot, getDesignSkillsRoot } from "../shared/paths.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Path Resolution", () => {
  it("should resolve GS install root to a directory with package.json", () => {
    const root = getGSInstallRoot();
    expect(existsSync(join(root, "package.json"))).toBe(true);
  });

  it("should resolve open design root under GS install root", () => {
    const odRoot = getOpenDesignRoot();
    expect(odRoot).toContain("open-design");
  });

  it("should resolve design systems root under open-design", () => {
    const dsRoot = getDesignSystemsRoot();
    expect(dsRoot).toContain("design-systems");
  });

  it("should resolve design skills root under open-design", () => {
    const skillsRoot = getDesignSkillsRoot();
    expect(skillsRoot).toContain("skills");
  });

  it("should respect GS_ROOT env var when set", () => {
    const originalEnv = process.env.GS_ROOT;
    process.env.GS_ROOT = process.cwd(); // Use current dir as override
    const root = getGSInstallRoot();
    expect(root).toBe(process.cwd());
    // Restore
    if (originalEnv) {
      process.env.GS_ROOT = originalEnv;
    } else {
      delete process.env.GS_ROOT;
    }
  });
});
