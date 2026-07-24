import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectWranglerManifest } from "../src/wrangler.mjs";
import { temporaryDirectory, write } from "./helpers.mjs";

const root = dirname(fileURLToPath(import.meta.url));

test("Wrangler compatibility fixture covers supported binding types", async () => {
  const result = await collectWranglerManifest(root, "fixtures/wrangler/full-matrix.jsonc");
  assert.deepEqual(result.bindings.map((item) => item.type), [
    "analytics-engine",
    "assets",
    "d1",
    "durable-object",
    "hyperdrive",
    "kv",
    "mtls-certificate",
    "queue-producer",
    "r2",
    "service",
    "vectorize",
  ]);
  assert.deepEqual(result.variableNames, ["PUBLIC_MODE"]);
  assert.equal(result.versionMetadataBinding, "VERSION");
  assert.equal(result.compatibilityDate, "2026-07-24");
  assert.deepEqual(result.compatibilityFlags, ["nodejs_compat"]);

  const source = readFileSync(join(root, "fixtures/wrangler/full-matrix.jsonc"), "utf8");
  const serialized = JSON.stringify(result);
  for (const privateReference of [
    "example-bucket",
    "example-dataset",
    "example-index",
    "example-queue",
    "example-service",
    "PUBLIC_MODE",
  ]) {
    if (privateReference === "PUBLIC_MODE") continue;
    assert.equal(serialized.includes(privateReference), false, source);
  }
});

test("named Wrangler environments do not inherit bindings or vars", async () => {
  const result = await collectWranglerManifest(root, "fixtures/wrangler/environment-matrix.jsonc", "production");
  assert.deepEqual(result.bindings.map((item) => item.binding), [
    "PRODUCTION_ASSETS",
    "PRODUCTION_DB",
  ]);
  assert.deepEqual(result.variableNames, ["DEPLOY_ENV"]);
});

test("unsupported Wrangler binding shapes fail closed", async (t) => {
  const repository = temporaryDirectory(t);
  write(repository, "wrangler.jsonc", JSON.stringify({
    d1_databases: {
      binding: "DB",
      database_id: "not-an-array",
    },
  }));
  await assert.rejects(
    collectWranglerManifest(repository, "wrangler.jsonc"),
    { code: "INVALID_WRANGLER_BINDING" },
  );
});

test("missing binding names fail closed", async (t) => {
  const repository = temporaryDirectory(t);
  write(repository, "wrangler.jsonc", JSON.stringify({
    r2_buckets: [{ bucket_name: "example" }],
  }));
  await assert.rejects(
    collectWranglerManifest(repository, "wrangler.jsonc"),
    { code: "INVALID_WRANGLER_BINDING" },
  );
});
