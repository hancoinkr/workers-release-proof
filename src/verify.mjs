import { isDeepStrictEqual } from "node:util";
import { invariant } from "./errors.mjs";
import { collectReleaseState, verifyEvidenceIntegrity } from "./evidence.mjs";

function same(actual, expected, code, message) {
  invariant(isDeepStrictEqual(actual, expected), code, message);
}

export async function verifyEvidence(root, config, evidence, options = {}) {
  const now = options.now ?? Date.now();
  invariant(evidence?.schemaVersion === 1, "INVALID_EVIDENCE", "Only evidence schemaVersion 1 is supported");
  invariant(evidence.phase === config.phase, "PHASE_MISMATCH", "Evidence phase does not match configuration");
  verifyEvidenceIntegrity(evidence);

  const generatedAt = Date.parse(evidence.generatedAt);
  invariant(Number.isFinite(generatedAt) && generatedAt <= now, "INVALID_EVIDENCE_TIME", "Evidence timestamp is invalid");
  invariant(now - generatedAt <= config.maxEvidenceAgeMinutes * 60_000, "STALE_EVIDENCE", "Evidence is stale");

  const current = await collectReleaseState(root, config, options);
  same(current.repository, evidence.repository, "REPOSITORY_MISMATCH", "Repository state changed after evidence generation");
  same(current.artifact, evidence.artifact, "ARTIFACT_MISMATCH", "Artifact tree changed after evidence generation");
  same(current.migrations, evidence.migrations, "MIGRATIONS_MISMATCH", "Migration manifest changed after evidence generation");
  same(current.wrangler, evidence.wrangler, "WRANGLER_MISMATCH", "Sanitized Wrangler manifest changed after evidence generation");
  same(current.rollback, evidence.rollback, "ROLLBACK_MISMATCH", "Rollback record changed after evidence generation");

  const currentHealthShape = current.health.map((record) => ({
    assertions: record.assertions,
    id: record.id,
    observedStatus: record.observedStatus,
  }));
  const evidenceHealthShape = evidence.health.map((record) => ({
    assertions: record.assertions,
    id: record.id,
    observedStatus: record.observedStatus,
  }));
  same(currentHealthShape, evidenceHealthShape, "HEALTH_SHAPE_MISMATCH", "Health checks no longer satisfy the evidence contract");

  return {
    artifactSha256: current.artifact.sha256,
    commitSha: current.repository.commitSha,
    evidenceSha256: evidence.integrity.sha256,
    healthCheckCount: current.health.length,
    migrationsSha256: current.migrations.sha256,
    result: "pass",
  };
}
