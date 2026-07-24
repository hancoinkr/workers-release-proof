import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { resolveReadableFileInside } from "./path-safety.mjs";

export async function collectRollbackRecord(root, relativePath, release, maxAgeMinutes, now = Date.now()) {
  if (relativePath === null) return null;
  const path = await resolveReadableFileInside(root, relativePath, "rollbackRecord");
  const bytes = await readFile(path);
  const record = JSON.parse(bytes.toString("utf8"));

  for (const field of ["currentDeploymentId", "previousDeploymentId", "commitSha", "artifactSha256", "migrationsSha256", "observedAt"]) {
    invariant(typeof record[field] === "string" && record[field].length > 0, "INVALID_ROLLBACK_RECORD", `rollback record field is required: ${field}`);
  }
  invariant(record.currentDeploymentId !== record.previousDeploymentId, "INVALID_ROLLBACK_RECORD", "Current and previous deployment IDs must differ");
  invariant(record.commitSha === release.commitSha, "ROLLBACK_COMMIT_MISMATCH", "Rollback record does not match the candidate commit");
  invariant(record.artifactSha256 === release.artifactSha256, "ROLLBACK_ARTIFACT_MISMATCH", "Rollback record does not match the candidate artifact");
  invariant(record.migrationsSha256 === release.migrationsSha256, "ROLLBACK_MIGRATIONS_MISMATCH", "Rollback record does not match the candidate migrations");

  const observedAt = Date.parse(record.observedAt);
  invariant(Number.isFinite(observedAt) && observedAt <= now, "INVALID_ROLLBACK_RECORD", "Rollback observation timestamp is invalid");
  invariant(now - observedAt <= maxAgeMinutes * 60_000, "STALE_ROLLBACK_RECORD", "Rollback record is stale");

  return {
    currentDeploymentId: record.currentDeploymentId,
    observedAt: new Date(observedAt).toISOString(),
    previousDeploymentId: record.previousDeploymentId,
    recordSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
