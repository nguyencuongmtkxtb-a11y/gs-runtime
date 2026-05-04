const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /credentials/i,
  /secret/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /id_rsa$/i,
  /id_ed25519$/i,
  /id_ecdsa$/i,
  /\.htpasswd$/i,
  /\.npmrc$/i,
  /\.netrc$/i,
  /config\.json$/i,
  /\.aws\//i,
  /\.ssh\//i,
];

const ALWAYS_ALLOWED = [
  ".env.example",
  ".env.sample",
  ".env.template",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
];

export interface PrivacyCheckResult {
  blocked: boolean;
  filePath: string;
  reason: string;
  question: string;
}

export function checkPrivacy(filePath: string): PrivacyCheckResult {
  const fileName = filePath.split(/[/\\]/).pop() ?? "";
  const normalized = filePath.replace(/\\/g, "/");

  for (const allowed of ALWAYS_ALLOWED) {
    if (normalized.endsWith(allowed)) {
      return { blocked: false, filePath, reason: "", question: "" };
    }
  }

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(fileName) || pattern.test(normalized)) {
      return {
        blocked: true,
        filePath,
        reason: `File "${filePath}" matches sensitive pattern "${pattern}".`,
        question: `I need to read "${filePath}" which may contain sensitive data. Do you approve?`,
      };
    }
  }

  return { blocked: false, filePath, reason: "", question: "" };
}

export function buildPrivacyPrompt(result: PrivacyCheckResult): string {
  return JSON.stringify({
    privacy_block: true,
    file: result.filePath,
    reason: result.reason,
    action_required: "Use AskUserQuestion tool to get approval",
    question: result.question,
    options: [
      { label: "Yes, approve access", description: "Allow reading this file this time" },
      { label: "No, skip this file", description: "Continue without accessing this file" },
    ],
  }, null, 2);
}
