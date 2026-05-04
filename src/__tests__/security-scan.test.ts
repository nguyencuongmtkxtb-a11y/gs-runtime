import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { scanFile } from "../hooks/security-scan.js";

const TEST_ROOT = join(process.cwd(), ".test-security-scan");

describe("Security Scan", () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
    mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ROOT)) rmSync(TEST_ROOT, { recursive: true });
  });

  describe("scanFile", () => {
    it("should detect hardcoded API key", () => {
      writeFileSync(join(TEST_ROOT, "config.ts"), `const api_key = "sk_live_1234567890abcdefgh";`);
      const result = scanFile(TEST_ROOT, "config.ts");
      expect(result.passed).toBe(false);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("hardcoded-api-key");
    });

    it("should detect private key", () => {
      writeFileSync(join(TEST_ROOT, "key.ts"), `const key = "-----BEGIN RSA PRIVATE KEY-----";`);
      const result = scanFile(TEST_ROOT, "key.ts");
      expect(result.passed).toBe(false);
      expect(result.findings.some((f) => f.type === "private-key")).toBe(true);
    });

    it("should detect OpenAI key pattern", () => {
      writeFileSync(join(TEST_ROOT, "ai.ts"), `const key = "sk-abcdefghijklmnopqrstuvwxyz0123456789";`);
      const result = scanFile(TEST_ROOT, "ai.ts");
      expect(result.findings.some((f) => f.type === "openai-sk-key")).toBe(true);
    });

    it("should detect GitHub token", () => {
      writeFileSync(join(TEST_ROOT, "gh.ts"), `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";`);
      const result = scanFile(TEST_ROOT, "gh.ts");
      expect(result.findings.some((f) => f.type === "github-token")).toBe(true);
    });

    it("should detect eval() usage", () => {
      writeFileSync(join(TEST_ROOT, "risky.ts"), `const result = eval("2+2");`);
      const result = scanFile(TEST_ROOT, "risky.ts");
      expect(result.findings.some((f) => f.type === "eval-usage")).toBe(true);
    });

    it("should pass for clean code", () => {
      writeFileSync(join(TEST_ROOT, "clean.ts"), `export function add(a: number, b: number): number { return a + b; }`);
      const result = scanFile(TEST_ROOT, "clean.ts");
      expect(result.passed).toBe(true);
      expect(result.findings).toHaveLength(0);
    });

    it("should skip comments", () => {
      writeFileSync(join(TEST_ROOT, "commented.ts"), `// api_key = "sk_live_1234567890abcdefgh"\nconst x = 1;`);
      const result = scanFile(TEST_ROOT, "commented.ts");
      expect(result.passed).toBe(true);
    });

    it("should flag sensitive files", () => {
      writeFileSync(join(TEST_ROOT, ".env"), `SECRET=hello`);
      const result = scanFile(TEST_ROOT, ".env");
      expect(result.passed).toBe(false);
      expect(result.findings.some((f) => f.type === "sensitive-file")).toBe(true);
    });

    it("should NOT flag .env.example", () => {
      writeFileSync(join(TEST_ROOT, ".env.example"), `SECRET=placeholder`);
      const result = scanFile(TEST_ROOT, ".env.example");
      expect(result.findings.filter((f) => f.type === "sensitive-file")).toHaveLength(0);
    });

    it("should respect project ignore config", () => {
      mkdirSync(join(TEST_ROOT, ".gs"), { recursive: true });
      mkdirSync(join(TEST_ROOT, "fixtures"), { recursive: true });
      writeFileSync(
        join(TEST_ROOT, ".gs", "security-rules.json"),
        JSON.stringify({ ignoreFiles: ["fixtures/mock.ts"], ignoreTypes: ["eval-usage"] })
      );
      writeFileSync(join(TEST_ROOT, "fixtures", "mock.ts"), `eval("danger")`);

      // File in ignore list
      const result1 = scanFile(TEST_ROOT, "fixtures/mock.ts");
      expect(result1.passed).toBe(true);

      // Type in ignore list
      writeFileSync(join(TEST_ROOT, "app.ts"), `const x = eval("2+2");`);
      const result2 = scanFile(TEST_ROOT, "app.ts");
      expect(result2.findings.filter((f) => f.type === "eval-usage")).toHaveLength(0);
    });
  });
});
