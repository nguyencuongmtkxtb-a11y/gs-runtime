import pc from "picocolors";

type LogLevel = "info" | "warn" | "error" | "success" | "debug";

const PREFIX = pc.cyan("[gs]");

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

export function log(level: LogLevel, message: string): void {
  const ts = pc.dim(`[${timestamp()}]`);
  switch (level) {
    case "info":
      console.log(`${ts} ${PREFIX} ${pc.white(message)}`);
      break;
    case "warn":
      console.warn(`${ts} ${PREFIX} ${pc.yellow(`WARN: ${message}`)}`);
      break;
    case "error":
      console.error(`${ts} ${PREFIX} ${pc.red(`ERROR: ${message}`)}`);
      break;
    case "success":
      console.log(`${ts} ${PREFIX} ${pc.green(message)}`);
      break;
    case "debug":
      if (process.env.GS_DEBUG) {
        console.log(`${ts} ${PREFIX} ${pc.dim(message)}`);
      }
      break;
  }
}

export function section(title: string): void {
  console.log("");
  console.log(`${PREFIX} ${pc.bold(pc.blue(`▸ ${title}`))}`);
  console.log(`${PREFIX} ${pc.dim("─".repeat(40))}`);
}

export function step(text: string): void {
  console.log(`${PREFIX}   ${pc.dim("•")} ${text}`);
}

export function code(text: string): void {
  console.log(`${PREFIX}   ${pc.dim("$")} ${pc.cyan(text)}`);
}

export function divider(): void {
  console.log(`${PREFIX} ${pc.dim("═".repeat(40))}`);
}

export const logger = { log, section, step, code, divider };
