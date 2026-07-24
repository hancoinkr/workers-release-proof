import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { parseJsonc } from "./jsonc.mjs";
import { resolveReadableFileInside } from "./path-safety.mjs";

const referenceFields = {
  "analytics-engine": ["dataset"],
  "d1": ["database_id", "database_name"],
  "durable-object": ["class_name", "script_name", "environment"],
  "hyperdrive": ["id"],
  "kv": ["id"],
  "mtls-certificate": ["certificate_id"],
  "queue-producer": ["queue"],
  "r2": ["bucket_name", "jurisdiction"],
  "service": ["service", "environment"],
  "vectorize": ["index_name"],
};

function referenceSha256(value, type) {
  const reference = {};
  for (const field of referenceFields[type] || []) {
    if (typeof value?.[field] === "string" && value[field].length > 0) {
      reference[field] = value[field];
    }
  }
  if (Object.keys(reference).length === 0) return null;
  return createHash("sha256").update(JSON.stringify(reference)).digest("hex");
}

function pushBindings(target, values, type) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const binding = typeof value?.binding === "string" ? value.binding : null;
    if (binding) {
      target.push({
        binding,
        referenceSha256: referenceSha256(value, type),
        type,
      });
    }
  }
}

export async function collectWranglerManifest(root, relativePath, environment = null) {
  const path = await resolveReadableFileInside(root, relativePath, "wranglerConfig");
  const config = parseJsonc(await readFile(path, "utf8"), relativePath);
  let bindingConfig = config;
  if (environment !== null) {
    invariant(config.env?.[environment] && typeof config.env[environment] === "object", "WRANGLER_ENVIRONMENT_MISSING", `Wrangler environment is not defined: ${environment}`);
    bindingConfig = config.env[environment];
  }
  const bindings = [];

  pushBindings(bindings, bindingConfig.d1_databases, "d1");
  pushBindings(bindings, bindingConfig.r2_buckets, "r2");
  pushBindings(bindings, bindingConfig.kv_namespaces, "kv");
  pushBindings(bindings, bindingConfig.services, "service");
  pushBindings(bindings, bindingConfig.analytics_engine_datasets, "analytics-engine");
  pushBindings(bindings, bindingConfig.vectorize, "vectorize");
  pushBindings(bindings, bindingConfig.hyperdrive, "hyperdrive");
  pushBindings(bindings, bindingConfig.mtls_certificates, "mtls-certificate");

  if (Array.isArray(bindingConfig.queues?.producers)) pushBindings(bindings, bindingConfig.queues.producers, "queue-producer");
  if (bindingConfig.durable_objects?.bindings) pushBindings(bindings, bindingConfig.durable_objects.bindings, "durable-object");

  bindings.sort((a, b) => `${a.type}:${a.binding}`.localeCompare(`${b.type}:${b.binding}`, "en"));
  const variableNames = Object.keys(bindingConfig.vars || {}).sort((a, b) => a.localeCompare(b, "en"));
  const manifest = {
    bindings,
    compatibilityDate: typeof bindingConfig.compatibility_date === "string"
      ? bindingConfig.compatibility_date
      : (typeof config.compatibility_date === "string" ? config.compatibility_date : null),
    compatibilityFlags: Array.isArray(bindingConfig.compatibility_flags)
      ? [...bindingConfig.compatibility_flags].sort()
      : (Array.isArray(config.compatibility_flags) ? [...config.compatibility_flags].sort() : []),
    environment,
    variableNames,
    versionMetadataBinding: typeof bindingConfig.version_metadata?.binding === "string"
      ? bindingConfig.version_metadata.binding
      : null,
  };

  return {
    ...manifest,
    algorithm: "sha256-sanitized-wrangler-v2",
    sha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
}
