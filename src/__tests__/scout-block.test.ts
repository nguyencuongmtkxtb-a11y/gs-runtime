import { describe, it, expect } from "vitest";
import { checkScout } from "../hooks/scout-block.js";

describe("checkScout", () => {
  const root = "/tmp/test-project";

  it("blocks relative paths in ignored directories", () => {
    expect(checkScout(root, "node_modules/foo/bar.js").blocked).toBe(true);
    expect(checkScout(root, "dist/index.js").blocked).toBe(true);
    expect(checkScout(root, ".git/objects/abc").blocked).toBe(true);
    expect(checkScout(root, "__pycache__/module.pyc").blocked).toBe(true);
  });

  it("allows relative paths not in ignored directories", () => {
    expect(checkScout(root, "src/index.ts").blocked).toBe(false);
    expect(checkScout(root, "package.json").blocked).toBe(false);
    expect(checkScout(root, "tests/unit/foo.test.ts").blocked).toBe(false);
  });

  it("handles Windows backslash paths", () => {
    expect(checkScout(root, "node_modules\\foo\\bar.js").blocked).toBe(true);
    expect(checkScout(root, "src\\components\\App.tsx").blocked).toBe(false);
  });

  it("handles Windows absolute paths with drive letter", () => {
    // Should strip drive letter and still detect blocked dirs
    expect(checkScout(root, "D:\\project\\node_modules\\foo.js").blocked).toBe(true);
    expect(checkScout(root, "C:/users/dev/project/dist/bundle.js").blocked).toBe(true);
    expect(checkScout(root, "E:\\workspace\\.git\\HEAD").blocked).toBe(true);

    // Should strip drive letter and allow non-blocked paths
    expect(checkScout(root, "D:\\velanet\\src\\index.ts").blocked).toBe(false);
    expect(checkScout(root, "C:/projects/myapp/package.json").blocked).toBe(false);
  });

  it("handles Unix absolute paths", () => {
    expect(checkScout(root, "/home/user/project/node_modules/foo.js").blocked).toBe(true);
    expect(checkScout(root, "/home/user/project/src/index.ts").blocked).toBe(false);
  });

  it("blocks nested ignored directories", () => {
    expect(checkScout(root, "packages/web/node_modules/react/index.js").blocked).toBe(true);
    expect(checkScout(root, "apps/api/dist/server.js").blocked).toBe(true);
  });
});
