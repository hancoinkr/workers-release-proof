import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const receiptUrl = new URL("../docs/adoption/bitcoinkevin.json", import.meta.url);
const receipt = JSON.parse(await readFile(receiptUrl, "utf8"));
const response = await fetch(receipt.health.url, {
  headers: {
    accept: "application/json",
    "cache-control": "no-cache",
  },
  redirect: "error",
  signal: AbortSignal.timeout(15_000),
});

assert.equal(response.status, receipt.health.expectedStatus, "Production reference returned an unexpected status");
const bytes = Buffer.from(await response.arrayBuffer());
assert.ok(bytes.length <= 1024 * 1024, "Production reference response exceeded 1 MiB");
const payload = JSON.parse(bytes.toString("utf8"));

function valueAtPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (current === null || current === undefined || !Object.hasOwn(current, segment)) return undefined;
    return current[segment];
  }, value);
}

for (const assertion of receipt.health.assertions) {
  assert.deepEqual(
    valueAtPath(payload, assertion.path),
    assertion.equals,
    `Production reference assertion failed: ${assertion.path}`,
  );
}

assert.match(payload.data.release.commitSha, /^[a-f0-9]{40}$/);
assert.match(payload.data.release.artifactSha256, /^[a-f0-9]{64}$/);
process.stdout.write(`${JSON.stringify({
  assertionCount: receipt.health.assertions.length,
  observedCommitSha: payload.data.release.commitSha,
  project: receipt.project.name,
  result: "pass",
})}\n`);
