import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function temporaryDirectory(t, prefix = "workers-release-proof-") {
  const root = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  return root;
}

export function write(root, relativePath, contents) {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
  return path;
}

export function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function createRepository(t, overrides = {}) {
  const root = temporaryDirectory(t);
  write(root, ".gitignore", ".release-proof/\n");
  write(root, "dist/index.js", overrides.artifact ?? "export default { fetch() {} };\n");
  write(root, "migrations/0001_initial.sql", "CREATE TABLE proof (id INTEGER PRIMARY KEY);\n");
  write(root, "wrangler.jsonc", `{
  // Public structure only.
  "name": "test-worker",
  "main": "dist/index.js",
  "compatibility_date": "2026-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "test",
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ],
  "vars": {
    "DEPLOY_ENV": "test"
  }
}\n`);
  write(root, "release-proof.config.json", `${JSON.stringify({
    artifactDirectories: ["dist"],
    healthChecks: [],
    maxEvidenceAgeMinutes: 60,
    migrationDirectories: ["migrations"],
    phase: "predeploy",
    requireCleanWorktree: overrides.requireCleanWorktree ?? true,
    rollbackRecord: null,
    schemaVersion: 1,
    secretScan: { exclude: [] },
    wranglerConfig: "wrangler.jsonc",
  }, null, 2)}\n`);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Test Maintainer"]);
  git(root, ["config", "user.email", "maintainer@example.invalid"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "test fixture"]);
  return root;
}
