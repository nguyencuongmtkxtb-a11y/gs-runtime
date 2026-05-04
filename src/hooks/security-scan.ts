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

const SECRET_PATTERNS = [
  { regex: /(?:api[_-]?key|apikey|api_secret|secret[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/gi, type: "hardcoded-api-key", severity: "critical" as const, message: "Hardcoded API key detected" },
  { regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, type: "hardcoded-password", severity: "critical" as const, message: "Hardcoded password detected" },
  { regex: /(?:token|access[_-]?token|auth[_-]?token|jwt)\s*[:=]\s*['"][^'"]{16,}['"]/gi, type: "hardcoded-token", severity: "critical" as const, message: "Hardcoded auth token detected" },
  { regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, type: "private-key", severity: "critical" as const, message: "Private key detected" },
  { regex: /sk-[a-zA-Z0-9]{32,}/g, type: "openai-sk-key", severity: "critical" as const, message: "OpenAI/Anthropic secret key pattern detected" },
  { regex: /ghp_[a-zA-Z0-9]{36}/g, type: "github-token", severity: "critical" as const, message: "GitHub personal access token detected" },
  { regex: /AKIA[0-9A-Z]{16}/g, type: "aws-access-key", severity: "critical" as const, message: "AWS access key detected" },
  { regex: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/g, type: "mongodb-credentials", severity: "critical" as const, message: "MongoDB connection string with credentials detected" },
  { regex: /postgres:\/\/[^:]+:[^@]+@/g, type: "postgres-credentials", severity: "critical" as const, message: "PostgreSQL connection string with credentials detected" },
  { regex: /redis:\/\/[^:]+:[^@]+@/g, type: "redis-credentials", severity: "critical" as const, message: "Redis connection string with credentials detected" },
];

const VULNERABILITY_PATTERNS = [
  { regex: /eval\s*\(/g, type: "eval-usage", severity: "high" as const, message: "Use of eval() — code injection risk" },
  { regex: /dangerouslySetInnerHTML\s*[={]/g, type: "xss-dangerous-html", severity: "high" as const, message: "dangerouslySetInnerHTML — XSS risk" },
  { regex: /innerHTML\s*=/g, type: "xss-innerhtml", severity: "medium" as const, message: "Direct innerHTML assignment — potential XSS" },
  { regex: /document\.write\s*\(/g, type: "xss-document-write", severity: "medium" as const, message: "document.write() — XSS risk" },
  { regex: /exec\s*\(\s*['"`].*\$\{/g, type: "command-injection", severity: "high" as const, message: "Potential command injection via exec()" },
  { regex: /\.execute\s*\(\s*['"`].*\$\{/g, type: "sql-injection", severity: "high" as const, message: "Potential SQL injection — use parameterized queries" },
];

const SENSITIVE_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\.local$/i,
  /credentials\.json$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /secret/i,
];

export function scanStagedFiles(root: string): SecurityScanResult {
  const findings: SecurityFinding[] = [];
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

  for (const file of stagedFiles) {
    const fullPath = join(root, file);
    if (!existsSync(fullPath)) continue;

    const fileName = file.split(/[/\\]/).pop() ?? "";

    for (const pattern of SENSITIVE_FILE_PATTERNS) {
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

      for (const pattern of SECRET_PATTERNS) {
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

      for (const pattern of VULNERABILITY_PATTERNS) {
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

  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;

  return {
    passed: critical === 0,
    findings,
    summary: critical > 0
      ? `SECURITY BLOCK: ${critical} critical, ${high} high, ${medium} medium findings`
      : `Security scan passed. ${high} high, ${medium} medium findings (non-blocking)`,
  };
}

export function scanFile(root: string, filePath: string): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const fullPath = join(root, filePath.replace(/^\//, ""));
  if (!existsSync(fullPath)) return { passed: true, findings: [], summary: "File not found." };

  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
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

    for (const pattern of SECRET_PATTERNS) {
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

  return {
    passed: findings.filter((f) => f.severity === "critical").length === 0,
    findings,
    summary: findings.length > 0 ? `${findings.length} finding(s)` : "No issues found.",
  };
}
