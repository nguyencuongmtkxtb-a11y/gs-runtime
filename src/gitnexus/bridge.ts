/**
 * GitNexus Bridge — Orchestration-Only Layer
 *
 * IMPORTANT: This bridge handles ONLY indexing orchestration (analyze, check index).
 * Actual graph queries (query, context, impact, detect_changes) are performed by
 * GitNexus's own MCP server which OpenCode connects to directly.
 *
 * GS MCP server's `gs_inject_context` returns instructions for the agent to use
 * GitNexus MCP tools — it does NOT proxy graph queries through this bridge.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { logger } from "../shared/logger.js";

const isWin = platform() === "win32";
const SHELL = isWin ? true : false;

let gitnexusAvailable: boolean | null = null;

export function isAvailable(): boolean {
  if (gitnexusAvailable !== null) return gitnexusAvailable;
  const result = spawnSync("gitnexus", ["--version"], {
    stdio: "pipe",
    timeout: 5000,
    shell: SHELL,
  });
  if (result.status === 0) {
    gitnexusAvailable = true;
    return true;
  }
  const npxResult = spawnSync("npx", ["-y", "gitnexus@latest", "--version"], {
    stdio: "pipe",
    timeout: 15000,
  });
  gitnexusAvailable = npxResult.status === 0;
  return gitnexusAvailable;
}

function runGitNexus(args: string[], cwd?: string): { success: boolean; stdout: string; stderr: string } {
  if (!isAvailable()) {
    return { success: false, stdout: "", stderr: "GitNexus is not available. Install with: npm install -g gitnexus" };
  }
  const result = spawnSync("gitnexus", args, {
    stdio: "pipe",
    timeout: 120000,
    cwd: cwd ?? process.cwd(),
    encoding: "utf-8",
    shell: SHELL,
  });
  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
  };
}

/**
 * Trigger GitNexus indexing/analysis for the project.
 * This creates/refreshes the .gitnexus/ knowledge graph.
 */
export function analyze(projectPath?: string, force: boolean = false): { success: boolean; message: string } {
  logger.log("info", "Running GitNexus analysis...");
  const args = ["analyze"];
  if (force) args.push("--force");
  args.push("--skip-agents-md");

  const result = runGitNexus(args, projectPath);
  if (result.success) {
    logger.log("success", "GitNexus index created successfully");
    return { success: true, message: result.stdout };
  }
  logger.log("warn", `GitNexus analysis warning: ${result.stderr || result.stdout}`);
  return { success: false, message: result.stderr || "Analysis failed" };
}

/**
 * Check if GitNexus index exists for the project.
 */
export function checkIndex(projectPath?: string): { indexed: boolean; stale: boolean } {
  const gitnexusDir = `${projectPath ?? process.cwd()}/.gitnexus`;
  const indexed = existsSync(gitnexusDir);
  return { indexed, stale: false };
}

/**
 * Get GitNexus status for the project.
 */
export function getStatus(projectPath?: string): { indexed: boolean; stale: boolean; repos: string[] } {
  const result = runGitNexus(["status"], projectPath);
  const { indexed, stale } = checkIndex(projectPath);
  return {
    indexed,
    stale,
    repos: result.success ? result.stdout.split("\n").filter(Boolean) : [],
  };
}

export function getMCPConfig(): { command: string; args: string[] } {
  return {
    command: "gs",
    args: ["mcp-start"],
  };
}

export function getInstallInstructions(): string {
  return "npm install -g gitnexus\nnpx gitnexus setup";
}
