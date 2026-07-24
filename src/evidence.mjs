import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { invariant } from "./errors.mjs";
import { collectGitState } from "./git.mjs";
import { hashDirectories } from "./hash-tree.mjs";
import { runHealthChecks } from "./health.mjs";
import { collectMigrations } from "./migrations.mjs";
import {
  assertNoSymlinkComponents,
  resolveInside,
  resolveReadableFileInside,
} from "./path-safety.mjs";
import { collectRollbackRecord } from "./rollback.mjs";
import { assertNoSecrets, scanSecrets } from "./secret-scan.mjs";
import { collectWranglerManifest } from "./wrangler.mjs";

function integrityDigest(evidenceWithoutIntegrity) {
  return createHash("sha256").update(JSON.stringify(evidenceWithoutIntegrity)).digest("hex");
}

export async function collectReleaseState(root, config, options = {}) {
  const now = options.now ?? Date.now();
  const findings = await scanSecrets(root, config.secretScan);
  assertNoSecrets(findings);
  const repository = collectGitState(root);
  invariant(!config.requireCleanWorktree || repository.clean, "DIRTY_WORKTREE", `Release evidence requires a clean worktree; found ${repository.dirtyCount} changed path(s)`);

  const [artifact, migrations, wrangler] = await Promise.all([
    hashDirectories(root, config.artifactDirectories),
    collectMigrations(root, config.migrationDirectories),
    collectWranglerManifest(root, config.wranglerConfig, config.wranglerEnvironment),
  ]);
  const release = {
    artifactSha256: artifact.sha256,
    commitSha: repository.commitSha,
    migrationsSha256: migrations.sha256,
  };
  const health = await runHealthChecks(config.healthChecks, release, options.fetchImpl);
  const rollback = await collectRollbackRecord(root, config.rollbackRecord, release, config.maxEvidenceAgeMinutes, now);

  return {
    artifact,
    health,
    migrations,
    repository,
    rollback,
    secretScan: { findingCount: 0, result: "pass" },
    wrangler,
  };
}

export async function buildEvidence(root, config, options = {}) {
  const now = options.now ?? Date.now();
  const state = await collectReleaseState(root, config, { ...options, now });
  const evidence = {
    artifact: state.artifact,
    generatedAt: new Date(now).toISOString(),
    generator: { name: "workers-release-proof", version: "0.1.2" },
    health: state.health,
    migrations: state.migrations,
    phase: config.phase,
    policy: {
      maxEvidenceAgeMinutes: config.maxEvidenceAgeMinutes,
      requireCleanWorktree: config.requireCleanWorktree,
    },
    repository: state.repository,
    rollback: state.rollback,
    schemaVersion: 1,
    secretScan: state.secretScan,
    wrangler: state.wrangler,
  };
  return {
    ...evidence,
    integrity: {
      algorithm: "sha256-json-v1",
      sha256: integrityDigest(evidence),
    },
  };
}

export async function writeEvidence(root, relativePath, evidence) {
  const path = resolveInside(root, relativePath, "evidence path");
  await assertNoSymlinkComponents(root, path, "evidence path");
  const parent = dirname(path);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await assertNoSymlinkComponents(root, path, "evidence path");
  const parentMetadata = await lstat(parent);
  invariant(!parentMetadata.isSymbolicLink(), "SYMLINK_REJECTED", `Evidence directory is a symlink: ${relative(root, parent)}`);
  const temporary = `${path}.tmp-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, path);
  return path;
}

export async function readEvidence(root, relativePath) {
  const path = await resolveReadableFileInside(root, relativePath, "evidence path");
  return JSON.parse(await readFile(path, "utf8"));
}

export function verifyEvidenceIntegrity(evidence) {
  invariant(evidence?.integrity?.algorithm === "sha256-json-v1", "INVALID_EVIDENCE", "Evidence integrity algorithm is missing or unsupported");
  const { integrity, ...withoutIntegrity } = evidence;
  invariant(integrity.sha256 === integrityDigest(withoutIntegrity), "EVIDENCE_INTEGRITY_MISMATCH", "Evidence JSON integrity check failed");
}
