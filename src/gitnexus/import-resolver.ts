/**
 * Lightweight TypeScript/JavaScript import resolver.
 *
 * Supplements GitNexus when cross-file IMPORTS/CALLS edges are missing.
 * Parses import statements to build a dependency graph without full TypeScript
 * compilation — fast enough to run on every gs_inject_context call.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname, resolve, extname } from "node:path";

export interface ImportEdge {
  from: string; // relative file path of importer
  to: string; // relative file path of imported module
  symbols: string[]; // imported symbol names
}

export interface DependencyMap {
  /** Files that import from a given file (reverse lookup) */
  importedBy: Record<string, ImportEdge[]>;
  /** Files that a given file imports from */
  importsFrom: Record<string, ImportEdge[]>;
  /** Total edge count */
  edgeCount: number;
}

const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"];
const IGNORE_DIRS = ["node_modules", "dist", "build", ".next", ".git", ".gitnexus", ".gs", "coverage"];

const IMPORT_PATTERNS = [
  // import { X, Y } from './path'
  /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  // import X from './path'
  /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // import * as X from './path'
  /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
  // import type { X } from './path'
  /import\s+type\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g,
  // const X = require('./path')
  /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * Scan all TS/JS files in project and build import dependency map.
 */
export function buildDependencyMap(projectRoot: string): DependencyMap {
  const files = collectSourceFiles(projectRoot);
  const importedBy: Record<string, ImportEdge[]> = {};
  const importsFrom: Record<string, ImportEdge[]> = {};
  let edgeCount = 0;

  for (const filePath of files) {
    const relPath = relative(projectRoot, filePath).replace(/\\/g, "/");
    const content = readFileSafe(filePath);
    if (!content) continue;

    const imports = extractImports(content, filePath, projectRoot);

    for (const imp of imports) {
      const edge: ImportEdge = {
        from: relPath,
        to: imp.resolvedPath,
        symbols: imp.symbols,
      };

      if (!importsFrom[relPath]) importsFrom[relPath] = [];
      importsFrom[relPath].push(edge);

      if (!importedBy[imp.resolvedPath]) importedBy[imp.resolvedPath] = [];
      importedBy[imp.resolvedPath].push(edge);

      edgeCount++;
    }
  }

  return { importedBy, importsFrom, edgeCount };
}

/**
 * Get all files that depend on a given file (upstream callers).
 */
export function getUpstreamDependents(
  projectRoot: string,
  targetFile: string,
  depMap?: DependencyMap
): ImportEdge[] {
  const map = depMap ?? buildDependencyMap(projectRoot);
  const normalized = targetFile.replace(/\\/g, "/");
  return map.importedBy[normalized] ?? [];
}

/**
 * Get all files that a given file depends on (downstream dependencies).
 */
export function getDownstreamDependencies(
  projectRoot: string,
  sourceFile: string,
  depMap?: DependencyMap
): ImportEdge[] {
  const map = depMap ?? buildDependencyMap(projectRoot);
  const normalized = sourceFile.replace(/\\/g, "/");
  return map.importsFrom[normalized] ?? [];
}

/**
 * Calculate blast radius: how many files would be affected if target changes.
 * Walks upstream edges recursively up to maxDepth.
 */
export function calculateBlastRadius(
  projectRoot: string,
  targetFile: string,
  maxDepth: number = 3
): { depth: number; file: string; symbols: string[] }[] {
  const map = buildDependencyMap(projectRoot);
  const normalized = targetFile.replace(/\\/g, "/");
  const visited = new Set<string>();
  const results: { depth: number; file: string; symbols: string[] }[] = [];

  function walk(file: string, depth: number): void {
    if (depth > maxDepth) return;
    if (visited.has(file)) return;
    visited.add(file);

    const edges = map.importedBy[file] ?? [];
    for (const edge of edges) {
      if (!visited.has(edge.from)) {
        results.push({ depth, file: edge.from, symbols: edge.symbols });
        walk(edge.from, depth + 1);
      }
    }
  }

  walk(normalized, 1);
  return results;
}

// --- Internal helpers ---

interface ParsedImport {
  symbols: string[];
  resolvedPath: string; // relative to project root
}

function extractImports(content: string, filePath: string, projectRoot: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  const fileDir = dirname(filePath);

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(content)) !== null) {
      let symbols: string[];
      let specifier: string;

      if (pattern.source.includes("require")) {
        // require pattern: groups differ
        symbols = match[1]
          ? match[1].split(",").map((s) => s.trim().split(" as ")[0].trim()).filter(Boolean)
          : match[2] ? [match[2]] : [];
        specifier = match[3];
      } else {
        symbols = match[1].includes(",")
          ? match[1].split(",").map((s) => s.trim().split(" as ")[0].trim()).filter(Boolean)
          : [match[1].trim()];
        specifier = match[2];
      }

      // Only resolve relative imports (not node_modules)
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue;

      const resolved = resolveImportPath(specifier, fileDir, projectRoot);
      if (resolved) {
        results.push({ symbols, resolvedPath: resolved });
      }
    }
  }

  return results;
}

function resolveImportPath(specifier: string, fromDir: string, projectRoot: string): string | null {
  const base = resolve(fromDir, specifier);

  // Try exact match
  if (existsSync(base) && statSync(base).isFile()) {
    return relative(projectRoot, base).replace(/\\/g, "/");
  }

  // Try with extensions
  for (const ext of TS_EXTENSIONS) {
    const withExt = base + ext;
    if (existsSync(withExt)) {
      return relative(projectRoot, withExt).replace(/\\/g, "/");
    }
  }

  // Try /index.ts pattern
  for (const ext of TS_EXTENSIONS) {
    const indexPath = join(base, `index${ext}`);
    if (existsSync(indexPath)) {
      return relative(projectRoot, indexPath).replace(/\\/g, "/");
    }
  }

  // Try stripping .js extension and looking for .ts (ESM convention)
  if (specifier.endsWith(".js")) {
    const tsPath = base.replace(/\.js$/, ".ts");
    if (existsSync(tsPath)) {
      return relative(projectRoot, tsPath).replace(/\\/g, "/");
    }
  }

  return null;
}

function collectSourceFiles(rootDir: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORE_DIRS.includes(entry)) continue;

      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && TS_EXTENSIONS.includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files;
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
