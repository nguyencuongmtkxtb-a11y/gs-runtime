import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SecurityFinding {
  file: string;
  line: number;
  severity: "critical" | "high" | "medium";
  type: string;
  message: string;
  snippet: string;
}

export interface SecurityScanResult {
  passed: boolean;
  findings: SecurityFinding[];
  summary: string;
}

interface PatternRule {
  regex: RegExp;
  type: string;
  severity: "critical" | "high" | "medium";
  message: string;
}

interface SecurityConfig {
  extraSecretPatterns: PatternRule[];
  extraVulnerabilityPatterns: PatternRule[];
  extraSensitiveFiles: RegExp[];
  ignoreFiles: string[];
  ignoreTypes: string[];
}

const CONFIG_FILE = ".gs/security-rules.json";

const DEFAULT_SECRET_PATTERNS: PatternRule[] = [
  { regex: /(?:api[_-]?key|apikey|api_secret|secret[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/gi, type: "hardcoded-api-key", severity: "critical", message: "Hardcoded API key detected" },
  { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, type: "hardcoded-password", severity: "critical", message: "Hardcoded password detected" },
  { regex: /(?:token|access[_-]?token|auth[_-]?token|jwt)\s*[:=]\s*['"][^'"]{16,}['"]/gi, type: "hardcoded-token", severity: "critical", message: "Hardcoded auth token detected" },
  { regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, type: "private-key", severity: "critical", message: "Private key detected" },
  { regex: /sk-[a-zA-Z0-9]{32,}/g, type: "openai-sk-key", severity: "critical", message: "OpenAI/Anthropic secret key pattern detected" },
  { regex: /ghp_[a-zA-Z0-9]{36}/g, type: "github-token", severity: "critical", message: "GitHub personal access token detected" },
  { regex: /AKIA[0-9A-Z]{16}/g, type: "aws-access-key", severity: "critical", message: "AWS access key detected" },
  { regex: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/g, type: "mongodb-credentials", severity: "critical", message: "MongoDB connection string with credentials detected" },
  { regex: /postgres:\/\/[^:]+:[^@]+@/g, type: "postgres-credentials", severity: "critical", message: "PostgreSQL connection string with credentials detected" },
  { regex: /redis:\/\/[^:]+:[^@]+@/g, type: "redis-credentials", severity: "critical", message: "Redis connection string with credentials detected" },
];

const DEFAULT_VULNERABILITY_PATTERNS: PatternRule[] = [
  { regex: /eval\s*\(/g, type: "eval-usage", severity: "high", message: "Use of eval() — code injection risk" },
  { regex: /dangerouslySetInnerHTML\s*[={]/g, type: "xss-dangerous-html", severity: "high", message: "dangerouslySetInnerHTML — XSS risk" },
  { regex: /innerHTML\s*=/g, type: "xss-innerhtml", severity: "medium", message: "Direct innerHTML assignment — potential XSS" },
  { regex: /document\.write\s*\(/g, type: "xss-document-write", severity: "medium", message: "document.write() — XSS risk" },
  { regex: /exec\s*\(\s*['"`].*\$\{/g, type: "command-injection", severity: "high", message: "Potential command injection via exec()" },
  { regex: /\.execute\s*\(\s*['"`].*\$\{/g, type: "sql-injection", severity: "high", message: "Potential SQL injection — use parameterized queries" },
];

const DEFAULT_SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /\.env$/i,
  /\.env\.local$/i,
  /credentials\.json$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /secret/i,
];

/**
 * Load project-specific security rules from .gs/security-rules.json.
 * Format:
 * {
 *   "extraPatterns": [{ "regex": "pattern", "type": "name", "severity": "high", "message": "desc" }],
 *   "extraVulnerabilities": [...],
 *   "extraSensitiveFiles": ["pattern"],
 *   "ignoreFiles": ["path/to/ignore.ts"],
 *   "ignoreTypes": ["eval-usage"]
 * }
 */
function loadProjectConfig(root: string): SecurityConfig {
  const config: SecurityConfig = {
    extraSecretPatterns: [],
    extraVulnerabilityPatterns: [],
    extraSensitiveFiles: [],
    ignoreFiles: [],
    ignoreTypes: [],
  };

  const configPath = join(root, CONFIG_FILE);
  if (!existsSync(configPath)) return config;

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));

    if (Array.isArray(raw.extraPatterns)) {
      for (const p of raw.extraPatterns) {
        if (p.regex && p.type && p.severity && p.message) {
          config.extraSecretPatterns.push({
            regex: new RegExp(p.regex, p.flags ?? "gi"),
            type: p.type,
            severity: p.severity,
            message: p.message,
          });
        }
      }
    }

    if (Array.isArray(raw.extraVulnerabilities)) {
      for (const p of raw.extraVulnerabilities) {
        if (p.regex && p.type && p.severity && p.message) {
          config.extraVulnerabilityPatterns.push({
            regex: new RegExp(p.regex, p.flags ?? "g"),
            type: p.type,
            severity: p.severity,
            message: p.message,
          });
        }
      }
    }

    if (Array.isArray(raw.extraSensitiveFiles)) {
      for (const p of raw.extraSensitiveFiles) {
        config.extraSensitiveFiles.push(new RegExp(p, "i"));
      }
    }

    if (Array.isArray(raw.ignoreFiles)) {
      config.ignoreFiles = raw.ignoreFiles;
    }

    if (Array.isArray(raw.ignoreTypes)) {
      config.ignoreTypes = raw.ignoreTypes;
    }
  } catch {
    // Invalid config — use defaults only
  }

  return config;
}

export function scanStagedFiles(root: string): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const config = loadProjectConfig(root);
  let stagedFiles: string[] = [];

  try {
    const output = execSync("git diff --cached --name-only", { cwd: root, encoding: "utf-8", timeout: 5000 });
    stagedFiles = output.split("\n").filter((f) => f.trim());
  } catch {
    try {
      const output = execSync("git diff --name-only", { cwd: root, encoding: "utf-8", timeout: 5000 });
      stagedFiles = output.split("\n").filter((f) => f.trim());
    } catch {
      return { passed: true, findings: [], summary: "No git available. Skipping security scan." };
    }
  }

  if (stagedFiles.length === 0) {
    return { passed: true, findings: [], summary: "No changed files to scan." };
  }

  // Merge default + project-specific patterns
  const secretPatterns = [...DEFAULT_SECRET_PATTERNS, ...config.extraSecretPatterns];
  const vulnerabilityPatterns = [...DEFAULT_VULNERABILITY_PATTERNS, ...config.extraVulnerabilityPatterns];
  const sensitiveFilePatterns = [...DEFAULT_SENSITIVE_FILE_PATTERNS, ...config.extraSensitiveFiles];

  for (const file of stagedFiles) {
    // Skip files in project ignore list
    if (config.ignoreFiles.some((ignored) => file.includes(ignored))) continue;

    const fullPath = join(root, file);
    if (!existsSync(fullPath)) continue;

    const fileName = file.split(/[/\\]/).pop() ?? "";

    for (const pattern of sensitiveFilePatterns) {
      if (pattern.test(fileName) || pattern.test(file)) {
        if (!fileName.includes(".example") && !fileName.includes(".sample") && !fileName.includes(".template")) {
          findings.push({
            file,
            line: 0,
            severity: "critical",
            type: "sensitive-file",
            message: `Sensitive file "${fileName}" should not be committed`,
            snippet: file,
          });
        }
      }
    }

    try {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (const pattern of secretPatterns) {
        pattern.regex.lastIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("*")) continue;
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(line);
          if (match) {
            findings.push({
              file,
              line: i + 1,
              severity: pattern.severity,
              type: pattern.type,
              message: pattern.message,
              snippet: line.trim().substring(0, 120),
            });
          }
        }
      }

      for (const pattern of vulnerabilityPatterns) {
        pattern.regex.lastIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("*")) continue;
          pattern.regex.lastIndex = 0;
          const match = pattern.regex.exec(line);
          if (match) {
            findings.push({
              file,
              line: i + 1,
              severity: pattern.severity,
              type: pattern.type,
              message: pattern.message,
              snippet: line.trim().substring(0, 120),
            });
          }
        }
      }
    } catch {
      // Binary file or unreadable — skip
    }
  }

  // Filter out ignored types from project config
  const filteredFindings = findings.filter((f) => !config.ignoreTypes.includes(f.type));

  const critical = filteredFindings.filter((f) => f.severity === "critical").length;
  const high = filteredFindings.filter((f) => f.severity === "high").length;
  const medium = filteredFindings.filter((f) => f.severity === "medium").length;

  return {
    passed: critical === 0,
    findings: filteredFindings,
    summary: critical > 0
      ? `SECURITY BLOCK: ${critical} critical, ${high} high, ${medium} medium findings`
      : `Security scan passed. ${high} high, ${medium} medium findings (non-blocking)`,
  };
}

export function scanFile(root: string, filePath: string): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const config = loadProjectConfig(root);
  const fullPath = join(root, filePath.replace(/^\//, ""));
  if (!existsSync(fullPath)) return { passed: true, findings: [], summary: "File not found." };

  if (config.ignoreFiles.some((ignored) => filePath.includes(ignored))) {
    return { passed: true, findings: [], summary: "File in ignore list." };
  }

  const sensitiveFilePatterns = [...DEFAULT_SENSITIVE_FILE_PATTERNS, ...config.extraSensitiveFiles];
  const secretPatterns = [...DEFAULT_SECRET_PATTERNS, ...config.extraSecretPatterns];
  const vulnerabilityPatterns = [...DEFAULT_VULNERABILITY_PATTERNS, ...config.extraVulnerabilityPatterns];

  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  for (const pattern of sensitiveFilePatterns) {
    if (pattern.test(fileName) || pattern.test(filePath)) {
      if (!fileName.includes(".example") && !fileName.includes(".sample") && !fileName.includes(".template")) {
        findings.push({
          file: filePath, line: 0, severity: "critical", type: "sensitive-file",
          message: `Sensitive file "${fileName}" should not be committed`, snippet: filePath,
        });
      }
    }
  }

  try {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("*")) continue;
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          findings.push({ file: filePath, line: i + 1, severity: pattern.severity, type: pattern.type, message: pattern.message, snippet: line.trim().substring(0, 120) });
        }
      }
    }

    for (const pattern of vulnerabilityPatterns) {
      pattern.regex.lastIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("*")) continue;
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          findings.push({ file: filePath, line: i + 1, severity: pattern.severity, type: pattern.type, message: pattern.message, snippet: line.trim().substring(0, 120) });
        }
      }
    }
  } catch {
    // Binary — skip
  }

  const filteredFindings = findings.filter((f) => !config.ignoreTypes.includes(f.type));

  return {
    passed: filteredFindings.filter((f) => f.severity === "critical").length === 0,
    findings: filteredFindings,
    summary: filteredFindings.length > 0 ? `${filteredFindings.length} finding(s)` : "No issues found.",
  };
}
