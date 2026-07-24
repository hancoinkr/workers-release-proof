import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;
const ignored = new Set([".git", "node_modules", ".release-proof"]);
const required = [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  "action.yml",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "LICENSE",
  "README.md",
  "ROADMAP.md",
  "SECURITY.md",
  "SUPPORT.md",
  "docs/architecture.md",
  "docs/security-model.md",
  "docs/maintainer-automation.md",
  "release-proof.config.example.json",
];

function filesBelow(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

const files = filesBelow(rootPath);
const relativeFiles = new Set(files.map((path) => relative(rootPath, path)));
for (const file of required) {
  if (!relativeFiles.has(file)) throw new Error(`Missing required project file: ${file}`);
}

for (const file of files) {
  const bytes = readFileSync(file);
  const rel = relative(rootPath, file);
  if (bytes.includes(0)) continue;
  const source = bytes.toString("utf8");
  if (source.includes("\r\n")) throw new Error(`CRLF is not allowed: ${rel}`);
  if (source.split("\n").some((line) => /[ \t]+$/.test(line))) {
    throw new Error(`Trailing whitespace found: ${rel}`);
  }
  if ([".json"].includes(extname(file))) JSON.parse(source);
  if ([".js", ".mjs"].includes(extname(file))) {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  }
}

const packageJson = JSON.parse(readFileSync(join(rootPath, "package.json"), "utf8"));
if (packageJson.private !== false) throw new Error("package.json must remain publishable");
if (packageJson.license !== "Apache-2.0") throw new Error("Unexpected package license");
if (!packageJson.engines?.node?.includes("22")) throw new Error("Node.js 22 support must be explicit");

const executable = statSync(join(rootPath, "bin/workers-release-proof.mjs")).mode & 0o111;
if (!executable) throw new Error("CLI entry point must be executable");

process.stdout.write(`quality: pass (${files.length} files)\n`);
