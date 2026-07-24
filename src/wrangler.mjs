import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseJsonc } from "./jsonc.mjs";
import { resolveReadableFileInside } from "./path-safety.mjs";

function pushBindings(target, values, type) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const binding = typeof value?.binding === "string" ? value.binding : null;
    if (binding) target.push({ binding, type });
  }
}

export async function collectWranglerManifest(root, relativePath) {
  const path = await resolveReadableFileInside(root, relativePath, "wranglerConfig");
  const config = parseJsonc(await readFile(path, "utf8"), relativePath);
  const bindings = [];

  pushBindings(bindings, config.d1_databases, "d1");
  pushBindings(bindings, config.r2_buckets, "r2");
  pushBindings(bindings, config.kv_namespaces, "kv");
  pushBindings(bindings, config.services, "service");
  pushBindings(bindings, config.analytics_engine_datasets, "analytics-engine");
  pushBindings(bindings, config.vectorize, "vectorize");
  pushBindings(bindings, config.hyperdrive, "hyperdrive");
  pushBindings(bindings, config.mtls_certificates, "mtls-certificate");

  if (Array.isArray(config.queues?.producers)) pushBindings(bindings, config.queues.producers, "queue-producer");
  if (config.durable_objects?.bindings) pushBindings(bindings, config.durable_objects.bindings, "durable-object");

  bindings.sort((a, b) => `${a.type}:${a.binding}`.localeCompare(`${b.type}:${b.binding}`, "en"));
  const variableNames = Object.keys(config.vars || {}).sort((a, b) => a.localeCompare(b, "en"));
  const manifest = {
    bindings,
    compatibilityDate: typeof config.compatibility_date === "string" ? config.compatibility_date : null,
    compatibilityFlags: Array.isArray(config.compatibility_flags) ? [...config.compatibility_flags].sort() : [],
    variableNames,
    versionMetadataBinding: typeof config.version_metadata?.binding === "string" ? config.version_metadata.binding : null,
  };

  return {
    ...manifest,
    algorithm: "sha256-sanitized-wrangler-v1",
    sha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
}
