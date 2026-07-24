import { createHash } from "node:crypto";
import { ProofError, invariant } from "./errors.mjs";

const MAX_RESPONSE_BYTES = 1024 * 1024;

function getPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (current === null || current === undefined || !Object.hasOwn(current, segment)) return undefined;
    return current[segment];
  }, value);
}

function expectedValue(value, release) {
  if (value === "$commitSha") return release.commitSha;
  if (value === "$artifactSha256") return release.artifactSha256;
  if (value === "$migrationsSha256") return release.migrationsSha256;
  return value;
}

export async function runHealthChecks(checks, release, fetchImpl = fetch) {
  const results = [];
  for (const check of checks) {
    let response;
    try {
      response = await fetchImpl(check.url, {
        headers: { accept: "application/json", "cache-control": "no-cache" },
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(check.timeoutMs),
      });
    } catch (error) {
      throw new ProofError("HEALTH_REQUEST_FAILED", `Health check failed: ${check.id}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    invariant(response.status === check.expectedStatus, "HEALTH_STATUS_MISMATCH", `Health check returned an unexpected status: ${check.id}`, {
      actual: response.status,
      expected: check.expectedStatus,
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    invariant(bytes.length <= MAX_RESPONSE_BYTES, "HEALTH_RESPONSE_TOO_LARGE", `Health response is too large: ${check.id}`);

    let payload;
    try {
      payload = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new ProofError("HEALTH_INVALID_JSON", `Health response is not valid JSON: ${check.id}`);
    }

    const assertions = [];
    for (const assertion of check.assertions) {
      const actual = getPath(payload, assertion.path);
      const expected = expectedValue(assertion.equals, release);
      invariant(Object.is(actual, expected), "HEALTH_ASSERTION_FAILED", `Health assertion failed: ${check.id}:${assertion.path}`);
      assertions.push({ path: assertion.path, result: "pass" });
    }

    results.push({
      assertions,
      id: check.id,
      observedStatus: response.status,
      responseSha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return results;
}
