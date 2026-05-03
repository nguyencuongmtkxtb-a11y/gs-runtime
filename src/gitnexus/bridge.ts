import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import type { GitNexusContext, GitNexusQueryResult } from "../shared/types.js";
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

export function checkIndex(projectPath?: string): { indexed: boolean; stale: boolean } {
  const gitnexusDir = `${projectPath ?? process.cwd()}/.gitnexus`;
  const indexed = existsSync(gitnexusDir);
  return { indexed, stale: false };
}

export function query(searchQuery: string, projectPath?: string): GitNexusContext {
  if (!isAvailable()) {
    return { query: searchQuery, results: null, indexed: false, error: "GitNexus not available" };
  }

  const mcpResult = runGitNexus(["mcp"], projectPath);
  if (!mcpResult.success) {
    return { query: searchQuery, results: null, indexed: false, error: "MCP server not available" };
  }

  const defaultResult: GitNexusQueryResult = {
    processes: [],
    definitions: [],
  };

  return {
    query: searchQuery,
    results: defaultResult,
    indexed: true,
    error: null,
  };
}

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
