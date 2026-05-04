import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

export interface EvalResult {
  file: string;
  test: string;
  passed: boolean;
  message: string;
}

export interface EvalReport {
  tier: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  results: EvalResult[];
}

let results: EvalResult[] = [];

function pass(file: string, test: string, message: string) {
  results.push({ file, test, passed: true, message });
}

function fail(file: string, test: string, message: string) {
  results.push({ file, test, passed: false, message });
}

function parseYamlFrontmatter(content: string): { valid: boolean; data: Record<string, unknown>; error?: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return { valid: false, data: {}, error: "No YAML frontmatter found" };

  const frontmatter = match[1];
  const data: Record<string, unknown> = {};
  let currentKey = "";
  let currentIndent = 0;
  const nestedStack: { key: string; indent: number }[] = [];

  for (const line of frontmatter.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    while (nestedStack.length > 0 && indent <= nestedStack[nestedStack.length - 1].indent) {
      nestedStack.pop();
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.substring(0, colonIdx).trim();
    const value = trimmed.substring(colonIdx + 1).trim();

    if (value === "" || value === "|" || value === ">") {
      if (indent === 0) {
        currentKey = key;
        currentIndent = indent;
        data[key] = {};
      } else {
        const parentPath = nestedStack.map((n) => n.key).join(".");
        const fullKey = parentPath ? `${parentPath}.${key}` : key;
        setNested(data, fullKey, {});
        nestedStack.push({ key, indent });
      }
    } else {
      if (indent === 0) {
        data[key] = parseValue(value);
      } else {
        const parentPath = nestedStack.map((n) => n.key).join(".");
        const fullKey = parentPath ? `${parentPath}.${key}` : key;
        setNested(data, fullKey, parseValue(value));
      }
    }
  }

  return { valid: true, data };
}

function parseValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  const quoted = value.match(/^["'](.+)["']$/);
  if (quoted) return quoted[1];
  return value;
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function validateSkillFile(filePath: string): void {
  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  try {
    const content = readFileSync(filePath, "utf-8");
    const { valid, data, error } = parseYamlFrontmatter(content);

    if (!valid) {
      fail(fileName, "frontmatter", error ?? "Invalid frontmatter");
      return;
    }
    pass(fileName, "frontmatter", "Valid YAML frontmatter");

    if (!data.name) {
      fail(fileName, "name", "Missing required 'name' field");
    } else {
      pass(fileName, "name", `name: ${data.name}`);
    }

    if (!data.description) {
      fail(fileName, "description", "Missing required 'description' field");
    } else {
      pass(fileName, "description", "Has description");
    }

    if (!data.mode && !data.scenario) {
      pass(fileName, "mode/scenario", "Design skill (no mode required)");
    } else if (data.mode) {
      const validModes = ["prototype", "deck", "image", "video", "audio", "design-system", "utility"];
      if (validModes.includes(data.mode as string)) {
        pass(fileName, "mode", `Valid mode: ${data.mode}`);
      } else {
        fail(fileName, "mode", `Invalid mode: "${data.mode}". Valid: ${validModes.join(", ")}`);
      }
    }

    if (data.scenario) {
      const validScenarios = ["marketing", "design", "operations", "engineering", "product", "finance", "hr", "education", "sales", "personal", "video", "planning"];
      if (validScenarios.includes(data.scenario as string)) {
        pass(fileName, "scenario", `Valid scenario: ${data.scenario}`);
      } else {
        fail(fileName, "scenario", `Invalid scenario: "${data.scenario}"`);
      }
    }

    if (content.includes("Lorem ipsum") || content.includes("lorem ipsum")) {
      fail(fileName, "no-lorem", "Contains Lorem ipsum placeholder text");
    } else {
      pass(fileName, "no-lorem", "No placeholder text");
    }
  } catch (err) {
    fail(fileName, "read", `Cannot read file: ${err}`);
  }
}

function walkDir(dir: string, pattern: string, callback: (path: string) => void): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, pattern, callback);
    } else if (extname(entry) === pattern || pattern === "*") {
      callback(fullPath);
    }
  }
}

export function runTier1(root: string): EvalReport {
  results = [];

  const skillDirs = [
    join(root, "skills"),
    join(root, "integrations", "open-design", "skills"),
  ];

  for (const dir of skillDirs) {
    walkDir(dir, ".md", (path) => {
      if (path.endsWith("SKILL.md")) {
        validateSkillFile(path);
      }
    });
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  return {
    tier: "1-static",
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    results,
  };
}
