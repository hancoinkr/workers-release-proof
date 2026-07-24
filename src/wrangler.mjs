import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { parseJsonc } from "./jsonc.mjs";
import { resolveReadableFileInside } from "./path-safety.mjs";

const referenceFields = {
  "analytics-engine": ["dataset"],
  "assets": ["directory"],
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

function bindingArray(config, key) {
  if (!Object.hasOwn(config, key)) return [];
  invariant(Array.isArray(config[key]), "INVALID_WRANGLER_BINDING", `${key} must be an array`);
  return config[key];
}

function bindingObject(config, key) {
  if (!Object.hasOwn(config, key)) return null;
  invariant(config[key] && typeof config[key] === "object" && !Array.isArray(config[key]), "INVALID_WRANGLER_BINDING", `${key} must be an object`);
  return config[key];
}

function pushBindings(target, values, type, label) {
  for (const [index, value] of values.entries()) {
    invariant(value && typeof value === "object" && !Array.isArray(value), "INVALID_WRANGLER_BINDING", `${label}[${index}] must be an object`);
    invariant(typeof value.binding === "string" && value.binding.length > 0, "INVALID_WRANGLER_BINDING", `${label}[${index}].binding is required`);
    target.push({
      binding: value.binding,
      referenceSha256: referenceSha256(value, type),
      type,
    });
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

  pushBindings(bindings, bindingArray(bindingConfig, "d1_databases"), "d1", "d1_databases");
  pushBindings(bindings, bindingArray(bindingConfig, "r2_buckets"), "r2", "r2_buckets");
  pushBindings(bindings, bindingArray(bindingConfig, "kv_namespaces"), "kv", "kv_namespaces");
  pushBindings(bindings, bindingArray(bindingConfig, "services"), "service", "services");
  pushBindings(bindings, bindingArray(bindingConfig, "analytics_engine_datasets"), "analytics-engine", "analytics_engine_datasets");
  pushBindings(bindings, bindingArray(bindingConfig, "vectorize"), "vectorize", "vectorize");
  pushBindings(bindings, bindingArray(bindingConfig, "hyperdrive"), "hyperdrive", "hyperdrive");
  pushBindings(bindings, bindingArray(bindingConfig, "mtls_certificates"), "mtls-certificate", "mtls_certificates");

  const queues = bindingObject(bindingConfig, "queues");
  if (queues) pushBindings(bindings, bindingArray(queues, "producers"), "queue-producer", "queues.producers");
  const durableObjects = bindingObject(bindingConfig, "durable_objects");
  if (durableObjects) pushBindings(bindings, bindingArray(durableObjects, "bindings"), "durable-object", "durable_objects.bindings");
  const assets = bindingObject(bindingConfig, "assets");
  if (assets && Object.hasOwn(assets, "binding")) {
    invariant(typeof assets.binding === "string" && assets.binding.length > 0, "INVALID_WRANGLER_BINDING", "assets.binding must be a non-empty string");
    bindings.push({
      binding: assets.binding,
      referenceSha256: referenceSha256(assets, "assets"),
      type: "assets",
    });
  }

  if (Object.hasOwn(bindingConfig, "vars")) {
    invariant(bindingConfig.vars && typeof bindingConfig.vars === "object" && !Array.isArray(bindingConfig.vars), "INVALID_WRANGLER_BINDING", "vars must be an object");
  }
  if (Object.hasOwn(bindingConfig, "compatibility_flags")) {
    invariant(Array.isArray(bindingConfig.compatibility_flags) && bindingConfig.compatibility_flags.every((flag) => typeof flag === "string"), "INVALID_WRANGLER_BINDING", "compatibility_flags must be an array of strings");
  }
  const versionMetadata = bindingObject(bindingConfig, "version_metadata");
  if (versionMetadata && Object.hasOwn(versionMetadata, "binding")) {
    invariant(typeof versionMetadata.binding === "string" && versionMetadata.binding.length > 0, "INVALID_WRANGLER_BINDING", "version_metadata.binding must be a non-empty string");
  }

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
    versionMetadataBinding: typeof versionMetadata?.binding === "string"
      ? versionMetadata.binding
      : null,
  };

  return {
    ...manifest,
    algorithm: "sha256-sanitized-wrangler-v2",
    sha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
}
