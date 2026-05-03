import { existsSync } from "node:fs";
import type { AgentInfo } from "./types.js";

const KNOWN_AGENTS: Array<{ name: string; displayName: string; protocol: AgentInfo["protocol"]; command: string }> = [
  { name: "claude", displayName: "Claude Code", protocol: "stdio", command: "claude" },
  { name: "codex", displayName: "Codex CLI", protocol: "stdio", command: "codex" },
  { name: "devin", displayName: "Devin for Terminal", protocol: "acp", command: "devin" },
  { name: "cursor-agent", displayName: "Cursor Agent", protocol: "stdio", command: "cursor-agent" },
  { name: "gemini", displayName: "Gemini CLI", protocol: "stdio", command: "gemini" },
  { name: "opencode", displayName: "OpenCode", protocol: "stdio", command: "opencode" },
  { name: "qwen", displayName: "Qwen Code", protocol: "stdio", command: "qwen" },
  { name: "copilot", displayName: "GitHub Copilot CLI", protocol: "stdio", command: "copilot" },
  { name: "hermes", displayName: "Hermes (ACP)", protocol: "acp", command: "hermes" },
  { name: "kimi", displayName: "Kimi CLI (ACP)", protocol: "acp", command: "kimi" },
  { name: "pi", displayName: "Pi (RPC)", protocol: "rpc", command: "pi" },
  { name: "kiro-cli", displayName: "Kiro CLI (ACP)", protocol: "acp", command: "kiro-cli" },
  { name: "vibe-acp", displayName: "Mistral Vibe CLI (ACP)", protocol: "acp", command: "vibe-acp" },
];

let cachedAgents: AgentInfo[] | null = null;

export function detectAgents(refresh: boolean = false): AgentInfo[] {
  if (cachedAgents && !refresh) return cachedAgents;

  const agents: AgentInfo[] = [];

  for (const agent of KNOWN_AGENTS) {
    agents.push({
      name: agent.name,
      displayName: agent.displayName,
      protocol: agent.protocol,
      path: detectCommand(agent.command),
      available: detectCommand(agent.command) !== null,
    });
  }

  cachedAgents = agents;
  return agents;
}

export function detectAgentByName(name: string): AgentInfo | null {
  const agents = detectAgents();
  return agents.find((a) => a.name === name) ?? null;
}

export function getAvailableAgents(): AgentInfo[] {
  return detectAgents().filter((a) => a.available);
}

function detectCommand(command: string): string | null {
  const isWindows = process.platform === "win32";
  const pathExt = isWindows ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [];

  if (!process.env.PATH) return null;

  const paths = process.env.PATH.split(isWindows ? ";" : ":");

  for (const dir of paths) {
    for (const ext of isWindows ? pathExt : [""]) {
      const fullPath = joinPath(isWindows, dir, command + ext);
      if (existsSync(fullPath)) return fullPath;
    }
  }

  return null;
}

function joinPath(isWindows: boolean, dir: string, filename: string): string {
  if (isWindows) {
    return `${dir}\\${filename}`;
  }
  return `${dir}/${filename}`;
}
