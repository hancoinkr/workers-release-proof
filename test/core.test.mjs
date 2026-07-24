import assert from "node:assert/strict";
import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashDirectories } from "../src/hash-tree.mjs";
import { runHealthChecks } from "../src/health.mjs";
import { parseJsonc } from "../src/jsonc.mjs";
import { collectMigrations } from "../src/migrations.mjs";
import { resolveInside, resolveReadableFileInside } from "../src/path-safety.mjs";
import { collectRollbackRecord } from "../src/rollback.mjs";
import { scanSecrets } from "../src/secret-scan.mjs";
import { collectWranglerManifest } from "../src/wrangler.mjs";
import { temporaryDirectory, write } from "./helpers.mjs";

test("JSONC accepts comments and trailing commas", () => {
  const value = parseJsonc(`{
    // comment
    "url": "https://example.com/a//b",
    "items": [1, 2,],
  }`);
  assert.deepEqual(value, { items: [1, 2], url: "https://example.com/a//b" });
});

test("JSONC preserves comment markers inside strings", () => {
  assert.equal(parseJsonc('{"value":"/* literal */"}').value, "/* literal */");
});

test("JSONC rejects unterminated block comments", () => {
  assert.throws(() => parseJsonc('{"value":1} /*'), { code: "INVALID_JSONC" });
});

test("JSONC rejects invalid source with a stable error code", () => {
  assert.throws(() => parseJsonc('{"value":}'), { code: "INVALID_JSONC" });
});

test("resolveInside accepts repository-relative paths", () => {
  const root = "/tmp/proof-root";
  assert.equal(resolveInside(root, "dist/index.js"), "/tmp/proof-root/dist/index.js");
});

test("resolveInside rejects path traversal", () => {
  assert.throws(() => resolveInside("/tmp/proof-root", "../private"), { code: "PATH_ESCAPE" });
});

test("resolveInside rejects absolute paths", () => {
  assert.throws(() => resolveInside("/tmp/proof-root", "/etc/passwd"), { code: "ABSOLUTE_PATH_REJECTED" });
});

test("readable paths reject intermediate symlinks", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "outside/config.json", "{}");
  symlinkSync(join(root, "outside"), join(root, "linked"), "dir");
  await assert.rejects(
    resolveReadableFileInside(root, "linked/config.json", "config"),
    { code: "SYMLINK_REJECTED" },
  );
});

test("readable paths reject a symlink repository root", async (t) => {
  const parent = temporaryDirectory(t);
  const root = join(parent, "real");
  mkdirSync(root);
  write(root, "config.json", "{}");
  const linkedRoot = join(parent, "linked");
  symlinkSync(root, linkedRoot, "dir");
  await assert.rejects(
    resolveReadableFileInside(linkedRoot, "config.json", "config"),
    { code: "SYMLINK_REJECTED" },
  );
});

test("artifact hash is deterministic across directory order", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "a/one.txt", "one");
  write(root, "b/two.txt", "two");
  const first = await hashDirectories(root, ["a", "b"]);
  const second = await hashDirectories(root, ["b", "a"]);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.fileCount, 2);
});

test("artifact hash changes with content", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "dist/index.js", "one");
  const first = await hashDirectories(root, ["dist"]);
  write(root, "dist/index.js", "two");
  const second = await hashDirectories(root, ["dist"]);
  assert.notEqual(first.sha256, second.sha256);
});

test("artifact collection rejects empty directories", async (t) => {
  const root = temporaryDirectory(t);
  mkdirSync(join(root, "dist"));
  await assert.rejects(hashDirectories(root, ["dist"]), { code: "EMPTY_ARTIFACT" });
});

test("artifact collection rejects symlinks", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "outside.txt", "outside");
  mkdirSync(join(root, "dist"));
  symlinkSync(join(root, "outside.txt"), join(root, "dist/link.txt"));
  await assert.rejects(hashDirectories(root, ["dist"]), { code: "SYMLINK_REJECTED" });
});

test("migration manifest includes only SQL files", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "migrations/0001.sql", "SELECT 1;\n");
  write(root, "migrations/README.md", "notes\n");
  const result = await collectMigrations(root, ["migrations"]);
  assert.equal(result.count, 1);
  assert.equal(result.files[0].path, "migrations/0001.sql");
});

test("migration collection rejects a directory without SQL", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "migrations/README.md", "notes\n");
  await assert.rejects(collectMigrations(root, ["migrations"]), { code: "EMPTY_MIGRATION_DIRECTORY" });
});

test("Wrangler manifest contains names but not values or identifiers", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "wrangler.jsonc", `{
    "compatibility_date": "2026-01-01",
    "d1_databases": [{
      "binding": "DB",
      "database_name": "private-name",
      "database_id": "private-id"
    }],
    "vars": {
      "PUBLIC_MODE": "private-value"
    }
  }`);
  const result = await collectWranglerManifest(root, "wrangler.jsonc");
  const serialized = JSON.stringify(result);
  assert.equal(result.bindings[0].binding, "DB");
  assert.equal(result.bindings[0].type, "d1");
  assert.match(result.bindings[0].referenceSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.environment, null);
  assert.deepEqual(result.variableNames, ["PUBLIC_MODE"]);
  assert.equal(serialized.includes("private-name"), false);
  assert.equal(serialized.includes("private-id"), false);
  assert.equal(serialized.includes("private-value"), false);
});

test("Wrangler manifest changes when a resource reference changes", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "wrangler.jsonc", `{
    "d1_databases": [{
      "binding": "DB",
      "database_name": "example",
      "database_id": "first-id"
    }]
  }`);
  const first = await collectWranglerManifest(root, "wrangler.jsonc");
  write(root, "wrangler.jsonc", `{
    "d1_databases": [{
      "binding": "DB",
      "database_name": "example",
      "database_id": "second-id"
    }]
  }`);
  const second = await collectWranglerManifest(root, "wrangler.jsonc");
  assert.notEqual(first.sha256, second.sha256);
  assert.notEqual(first.bindings[0].referenceSha256, second.bindings[0].referenceSha256);
});

test("Wrangler manifest uses non-inherited bindings from a named environment", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "wrangler.jsonc", `{
    "compatibility_date": "2026-01-01",
    "d1_databases": [{
      "binding": "TOP_LEVEL_DB",
      "database_id": "top-level-id"
    }],
    "env": {
      "production": {
        "d1_databases": [{
          "binding": "PRODUCTION_DB",
          "database_id": "production-id"
        }],
        "vars": {
          "DEPLOY_ENV": "production"
        }
      }
    }
  }`);
  const result = await collectWranglerManifest(root, "wrangler.jsonc", "production");
  assert.equal(result.environment, "production");
  assert.deepEqual(result.bindings.map((item) => item.binding), ["PRODUCTION_DB"]);
  assert.deepEqual(result.variableNames, ["DEPLOY_ENV"]);
  assert.equal(result.compatibilityDate, "2026-01-01");
});

test("Wrangler manifest rejects an undefined environment", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "wrangler.jsonc", '{"env":{}}');
  await assert.rejects(
    collectWranglerManifest(root, "wrangler.jsonc", "production"),
    { code: "WRANGLER_ENVIRONMENT_MISSING" },
  );
});

test("secret scan detects a token without returning its value", async (t) => {
  const root = temporaryDirectory(t);
  const credential = "ghp_" + "A".repeat(30);
  write(root, "source.txt", `value=${credential}\n`);
  const findings = await scanSecrets(root);
  assert.equal(findings.some((item) => item.code === "GITHUB_TOKEN"), true);
  assert.equal(JSON.stringify(findings).includes(credential), false);
});

test("secret scan detects sensitive filenames", async (t) => {
  const root = temporaryDirectory(t);
  write(root, ".env.production", "DEPLOY_ENV=example\n");
  const findings = await scanSecrets(root);
  assert.equal(findings.some((item) => item.code === "TRACKED_ENV_FILE"), true);
});

test("secret scan honors directory exclusions", async (t) => {
  const root = temporaryDirectory(t);
  const credential = "ghp_" + "B".repeat(30);
  write(root, "fixtures/source.txt", credential);
  assert.deepEqual(await scanSecrets(root, { exclude: ["fixtures"] }), []);
});

test("generic credential scan detects a non-placeholder assignment", async (t) => {
  const root = temporaryDirectory(t);
  const source = "api_" + "key = " + "live-credential-material-42";
  write(root, "config.txt", source);
  const findings = await scanSecrets(root);
  assert.equal(findings.some((item) => item.code === "HARDCODED_CREDENTIAL"), true);
});

test("generic credential scan detects quoted code literals", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "config.mjs", 'const client_secret = "live-credential-material-42";\n');
  const findings = await scanSecrets(root);
  assert.equal(findings.some((item) => item.code === "HARDCODED_CREDENTIAL"), true);
});

test("generic credential scan ignores code references and public placeholders", async (t) => {
  const root = temporaryDirectory(t);
  write(root, "source.mjs", [
    "const token = transfer?.token_info || {};",
    "const secret = env.AUTH_SIGNING_SECRET;",
    "const api_key = process.env.API_KEY;",
    'const fallbackSecret = "unconfigured-rate-limit-salt";',
    "",
  ].join("\n"));
  assert.deepEqual(await scanSecrets(root), []);
});

test("generic credential scan ignores fake test values but keeps provider rules active", async (t) => {
  const root = temporaryDirectory(t);
  const credential = "ghp_" + "C".repeat(30);
  write(root, "source.test.mjs", [
    'const secret = "moderator-secret-with-at-least-32-characters";',
    `const providerToken = "${credential}";`,
    "",
  ].join("\n"));
  const findings = await scanSecrets(root);
  assert.deepEqual(findings.map((item) => item.code), ["GITHUB_TOKEN"]);
});

test("health check validates release placeholders", async () => {
  const release = {
    artifactSha256: "artifact",
    commitSha: "commit",
    migrationsSha256: "migrations",
  };
  const checks = [{
    assertions: [
      { equals: "ok", path: "status" },
      { equals: "$commitSha", path: "release.commit" },
      { equals: "$artifactSha256", path: "release.artifact" },
    ],
    expectedStatus: 200,
    id: "health",
    timeoutMs: 1000,
    url: "https://example.invalid/health",
  }];
  const fetchImpl = async () => Response.json({
    release: { artifact: "artifact", commit: "commit" },
    status: "ok",
  });
  const results = await runHealthChecks(checks, release, fetchImpl);
  assert.equal(results[0].assertions.length, 3);
  assert.match(results[0].responseSha256, /^[a-f0-9]{64}$/);
});

test("health check fails a mismatched assertion", async () => {
  const checks = [{
    assertions: [{ equals: "ok", path: "status" }],
    expectedStatus: 200,
    id: "health",
    timeoutMs: 1000,
    url: "https://example.invalid/health",
  }];
  await assert.rejects(
    runHealthChecks(checks, {}, async () => Response.json({ status: "bad" })),
    { code: "HEALTH_ASSERTION_FAILED" },
  );
});

test("health check rejects invalid JSON", async () => {
  const checks = [{
    assertions: [],
    expectedStatus: 200,
    id: "health",
    timeoutMs: 1000,
    url: "https://example.invalid/health",
  }];
  await assert.rejects(
    runHealthChecks(checks, {}, async () => new Response("not json")),
    { code: "HEALTH_INVALID_JSON" },
  );
});

test("rollback record binds candidate digests", async (t) => {
  const root = temporaryDirectory(t);
  const now = Date.parse("2026-01-01T00:10:00.000Z");
  const release = {
    artifactSha256: "artifact",
    commitSha: "commit",
    migrationsSha256: "migrations",
  };
  write(root, "rollback.json", JSON.stringify({
    artifactSha256: "artifact",
    commitSha: "commit",
    currentDeploymentId: "current",
    migrationsSha256: "migrations",
    observedAt: "2026-01-01T00:09:00.000Z",
    previousDeploymentId: "previous",
  }));
  const result = await collectRollbackRecord(root, "rollback.json", release, 5, now);
  assert.equal(result.currentDeploymentId, "current");
  assert.equal(result.previousDeploymentId, "previous");
});

test("rollback record rejects stale observations", async (t) => {
  const root = temporaryDirectory(t);
  const release = {
    artifactSha256: "artifact",
    commitSha: "commit",
    migrationsSha256: "migrations",
  };
  write(root, "rollback.json", JSON.stringify({
    ...release,
    currentDeploymentId: "current",
    observedAt: "2026-01-01T00:00:00.000Z",
    previousDeploymentId: "previous",
  }));
  await assert.rejects(
    collectRollbackRecord(root, "rollback.json", release, 5, Date.parse("2026-01-01T00:10:00.000Z")),
    { code: "STALE_ROLLBACK_RECORD" },
  );
});

test("rollback evidence stores a digest rather than the original document", async (t) => {
  const root = temporaryDirectory(t);
  const release = {
    artifactSha256: "artifact",
    commitSha: "commit",
    migrationsSha256: "migrations",
  };
  write(root, "rollback.json", JSON.stringify({
    ...release,
    currentDeploymentId: "current",
    observedAt: "2026-01-01T00:00:00.000Z",
    previousDeploymentId: "previous",
  }));
  const result = await collectRollbackRecord(root, "rollback.json", release, 5, Date.parse("2026-01-01T00:01:00.000Z"));
  assert.match(result.recordSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(result).includes("artifact"), false);
  assert.equal(readFileSync(join(root, "rollback.json"), "utf8").includes("artifact"), true);
});
