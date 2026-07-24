import assert from "node:assert/strict";
import { chmodSync, mkdirSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";
import {
  buildEvidence,
  readEvidence,
  verifyEvidenceIntegrity,
  writeEvidence,
} from "../src/evidence.mjs";
import { collectGitState, listTrackedFiles } from "../src/git.mjs";
import { verifyEvidence } from "../src/verify.mjs";
import { createRepository, git, write } from "./helpers.mjs";

test("configuration applies safe defaults", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  assert.equal(config.phase, "predeploy");
  assert.equal(config.requireCleanWorktree, true);
  assert.equal(config.wranglerEnvironment, null);
  assert.deepEqual(config.healthChecks, []);
});

test("configuration rejects an empty Wrangler environment", async (t) => {
  const root = createRepository(t);
  write(root, "release-proof.config.json", JSON.stringify({
    artifactDirectories: ["dist"],
    migrationDirectories: ["migrations"],
    schemaVersion: 1,
    wranglerConfig: "wrangler.jsonc",
    wranglerEnvironment: "",
  }));
  await assert.rejects(loadConfig(root), { code: "INVALID_CONFIG" });
});

test("production configuration requires health and rollback evidence", async (t) => {
  const root = createRepository(t);
  write(root, "release-proof.config.json", JSON.stringify({
    artifactDirectories: ["dist"],
    migrationDirectories: ["migrations"],
    phase: "production",
    schemaVersion: 1,
    wranglerConfig: "wrangler.jsonc",
  }));
  await assert.rejects(loadConfig(root), { code: "INVALID_CONFIG" });
});

test("configuration rejects credential-bearing health URLs", async (t) => {
  const root = createRepository(t);
  write(root, "release-proof.config.json", JSON.stringify({
    artifactDirectories: ["dist"],
    healthChecks: [{
      assertions: [],
      id: "health",
      url: "https://user:pass@example.invalid/health",
    }],
    migrationDirectories: ["migrations"],
    schemaVersion: 1,
    wranglerConfig: "wrangler.jsonc",
  }));
  await assert.rejects(loadConfig(root), { code: "INVALID_CONFIG" });
});

test("configuration rejects health URL queries", async (t) => {
  const root = createRepository(t);
  write(root, "release-proof.config.json", JSON.stringify({
    artifactDirectories: ["dist"],
    healthChecks: [{
      assertions: [],
      id: "health",
      url: "https://example.invalid/health?key=example",
    }],
    migrationDirectories: ["migrations"],
    schemaVersion: 1,
    wranglerConfig: "wrangler.jsonc",
  }));
  await assert.rejects(loadConfig(root), { code: "INVALID_CONFIG" });
});

test("Git state records a full commit and clean worktree", (t) => {
  const root = createRepository(t);
  const state = collectGitState(root);
  assert.equal(state.clean, true);
  assert.equal(state.dirtyCount, 0);
  assert.match(state.commitSha, /^[a-f0-9]{40}$/);
});

test("tracked file listing is repository-scoped", (t) => {
  const root = createRepository(t);
  const files = listTrackedFiles(root);
  assert.equal(files.includes("dist/index.js"), true);
  assert.equal(files.includes(".git/config"), false);
});

test("evidence generation and immediate verification pass", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const evidence = await buildEvidence(root, config, { now });
  await writeEvidence(root, ".release-proof/evidence.json", evidence);
  const stored = await readEvidence(root, ".release-proof/evidence.json");
  const result = await verifyEvidence(root, config, stored, { now });
  assert.equal(result.result, "pass");
  assert.equal(result.commitSha, git(root, ["rev-parse", "HEAD"]));
});

test("evidence file uses owner-only permissions", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const evidence = await buildEvidence(root, config);
  const path = await writeEvidence(root, ".release-proof/evidence.json", evidence);
  assert.equal(statSync(path).mode & 0o777, 0o600);
});

test("evidence writer rejects a symlink directory", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const evidence = await buildEvidence(root, config);
  mkdirSync(join(root, "outside"));
  symlinkSync(join(root, "outside"), join(root, ".release-proof"), "dir");
  await assert.rejects(
    writeEvidence(root, ".release-proof/evidence.json", evidence),
    { code: "SYMLINK_REJECTED" },
  );
});

test("evidence integrity detects modification", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const evidence = await buildEvidence(root, config);
  evidence.repository.commitSha = "0".repeat(40);
  assert.throws(() => verifyEvidenceIntegrity(evidence), { code: "EVIDENCE_INTEGRITY_MISMATCH" });
});

test("evidence verification rejects stale evidence", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const generated = Date.parse("2026-01-01T00:00:00.000Z");
  const evidence = await buildEvidence(root, config, { now: generated });
  await assert.rejects(
    verifyEvidence(root, config, evidence, { now: generated + 61 * 60_000 }),
    { code: "STALE_EVIDENCE" },
  );
});

test("evidence generation rejects a dirty worktree", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  write(root, "dist/index.js", "changed\n");
  await assert.rejects(buildEvidence(root, config), { code: "DIRTY_WORKTREE" });
});

test("evidence verification rejects a new commit", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const evidence = await buildEvidence(root, config);
  write(root, "README.md", "next commit\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "next"]);
  await assert.rejects(verifyEvidence(root, config, evidence), { code: "REPOSITORY_MISMATCH" });
});

test("artifact mode participates in the tree digest", async (t) => {
  const root = createRepository(t);
  const config = await loadConfig(root);
  const first = await buildEvidence(root, config);
  chmodSync(join(root, "dist/index.js"), 0o755);
  git(root, ["add", "dist/index.js"]);
  git(root, ["commit", "-m", "make executable"]);
  const second = await buildEvidence(root, config);
  assert.notEqual(first.artifact.sha256, second.artifact.sha256);
});
