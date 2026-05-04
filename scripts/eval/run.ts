#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runTier1, type EvalReport } from "./tier-1-validators.js";

const root = process.argv[2] ?? process.cwd();
const resultsDir = join(root, "scripts", "eval", "results");

if (!existsSync(resultsDir)) {
  mkdirSync(resultsDir, { recursive: true });
}

const tier = process.argv[3] ?? "1";

let report: EvalReport;

switch (tier) {
  case "1":
    report = runTier1(root);
    break;
  default:
    console.error(`Unknown tier: ${tier}`);
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsFile = join(resultsDir, `eval-tier${tier}-${timestamp}.json`);
writeFileSync(resultsFile, JSON.stringify(report, null, 2), "utf-8");

console.log(`\n=== GS Eval Tier ${tier} ===`);
console.log(`Total: ${report.total} | Passed: ${report.passed} | Failed: ${report.failed}`);
console.log(`Results: ${resultsFile}`);

const failed = report.results.filter((r) => !r.passed);
if (failed.length > 0) {
  console.log("\n❌ Failures:");
  for (const f of failed) {
    console.log(`  [${f.test}] ${f.file}: ${f.message}`);
  }
}

if (report.failed > 0) {
  process.exit(1);
}

console.log("✅ All checks passed.");
process.exit(0);
