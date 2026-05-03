#!/usr/bin/env node
import { Command } from "commander";
import { StateMachine } from "./state-machine.js";
import { buildOpenCodeConfig, buildAgentsMd } from "./context-injector.js";
import { logger } from "../shared/logger.js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const program = new Command();

program
  .name("gs")
  .description("GS Runtime - Superpowers + GitNexus bridge for OpenCode")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize GS in the current project")
  .option("-f, --force", "Force reinitialize even if workflow in progress")
  .action(async (opts) => {
    const sm = new StateMachine();
    const result = await sm.init(opts.force);
    if (result.success) {
      logger.log("success", "GS initialized. Ready to start workflow.");
    } else {
      logger.log("error", result.message);
    }
  });

program
  .command("brainstorm")
  .description("Start brainstorming phase")
  .argument("<description>", "Feature or idea description")
  .action(async (description) => {
    const sm = new StateMachine();
    const result = await sm.brainstorm(description);
    if (!result.success) {
      logger.log("error", result.message);
      process.exit(1);
    }
  });

program
  .command("plan")
  .description("Start planning phase")
  .option("-f, --force", "Skip validation (not recommended)")
  .action(async (opts) => {
    const sm = new StateMachine();
    const result = await sm.plan(opts.force);
    if (!result.success) {
      logger.log("error", result.message);
      process.exit(1);
    }
  });

program
  .command("implement")
  .description("Start implementation phase")
  .option("-f, --force", "Skip validation (not recommended)")
  .action(async (opts) => {
    const sm = new StateMachine();
    const result = await sm.implement(opts.force);
    if (!result.success) {
      logger.log("error", result.message);
      process.exit(1);
    }
  });

program
  .command("review")
  .description("Start code review phase")
  .option("-f, --force", "Skip validation (not recommended)")
  .action(async (opts) => {
    const sm = new StateMachine();
    const result = await sm.review(opts.force);
    if (!result.success) {
      logger.log("error", result.message);
      process.exit(1);
    }
  });

program
  .command("finish")
  .description("Finish the workflow")
  .action(async () => {
    const sm = new StateMachine();
    const result = await sm.finish();
    if (!result.success) {
      logger.log("error", result.message);
      process.exit(1);
    }
  });

program
  .command("status")
  .description("Show current workflow status")
  .action(() => {
    const sm = new StateMachine();
    sm.status();
  });

program
  .command("reset")
  .description("Reset workflow state (danger: deletes progress)")
  .option("-y, --yes", "Skip confirmation prompt")
  .action((opts) => {
    if (opts.yes) {
      const sm = new StateMachine();
      sm.reset();
      return;
    }
    logger.log("warn", "This will delete all workflow progress. Continue? (y/N)");
    import("node:readline").then((readline) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("", (answer: string) => {
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          const sm = new StateMachine();
          sm.reset();
        } else {
          logger.log("info", "Reset cancelled.");
        }
        rl.close();
      });
    });
  });

program
  .command("index")
  .description("Force GitNexus indexing")
  .option("-f, --force", "Force full re-index")
  .action(async (opts) => {
    const sm = new StateMachine();
    await sm.autoIndex();
  });

program
  .command("config")
  .description("Show OpenCode MCP configuration for GS")
  .action(() => {
    const config = buildOpenCodeConfig();
    console.log(JSON.stringify(config, null, 2));
    logger.log("info", "Add the above to your ~/.config/opencode/config.json 'mcp' section.");
  });

program
  .command("agents-md")
  .description("Generate AGENTS.md content for this project")
  .action(() => {
    const content = buildAgentsMd();
    const path = join(process.cwd(), "AGENTS.md");
    writeFileSync(path, content, "utf-8");
    logger.log("success", `AGENTS.md written to ${path}`);
  });

program
  .command("mcp-start")
  .description("Start the GS MCP server (called by OpenCode)")
  .action(async () => {
    const { startMCPServer } = await import("../mcp/server.js");
    await startMCPServer();
  });

program.parse(process.argv);
