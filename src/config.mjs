import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { resolveReadableFileInside } from "./path-safety.mjs";

const defaults = {
  artifactDirectories: ["dist", ".wrangler/dry-run"],
  healthChecks: [],
  maxEvidenceAgeMinutes: 60,
  migrationDirectories: ["migrations"],
  phase: "predeploy",
  requireCleanWorktree: true,
  rollbackRecord: null,
  schemaVersion: 1,
  secretScan: { exclude: [] },
  wranglerConfig: "wrangler.jsonc",
  wranglerEnvironment: null,
};

function stringArray(value, label) {
  invariant(Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0), "INVALID_CONFIG", `${label} must be an array of non-empty strings`);
  return [...new Set(value)];
}

function validateHealthChecks(checks) {
  invariant(Array.isArray(checks), "INVALID_CONFIG", "healthChecks must be an array");
  const ids = new Set();
  return checks.map((check, index) => {
    invariant(check && typeof check === "object", "INVALID_CONFIG", `healthChecks[${index}] must be an object`);
    invariant(typeof check.id === "string" && check.id.length > 0, "INVALID_CONFIG", `healthChecks[${index}].id is required`);
    invariant(!ids.has(check.id), "INVALID_CONFIG", `Duplicate health check id: ${check.id}`);
    ids.add(check.id);

    let url;
    try {
      url = new URL(check.url);
    } catch {
      invariant(false, "INVALID_CONFIG", `healthChecks[${index}].url must be an absolute URL`);
    }
    invariant(["http:", "https:"].includes(url.protocol), "INVALID_CONFIG", `healthChecks[${index}].url must use HTTP or HTTPS`);
    invariant(url.username === "" && url.password === "", "INVALID_CONFIG", `healthChecks[${index}].url must not contain credentials`);
    invariant(url.search === "" && url.hash === "", "INVALID_CONFIG", `healthChecks[${index}].url must not contain a query or fragment`);

    const assertions = Array.isArray(check.assertions) ? check.assertions : [];
    for (const [assertionIndex, assertion] of assertions.entries()) {
      invariant(typeof assertion?.path === "string" && assertion.path.length > 0, "INVALID_CONFIG", `healthChecks[${index}].assertions[${assertionIndex}].path is required`);
      invariant(Object.hasOwn(assertion, "equals"), "INVALID_CONFIG", `healthChecks[${index}].assertions[${assertionIndex}].equals is required`);
    }

    return {
      assertions,
      expectedStatus: Number.isInteger(check.expectedStatus) ? check.expectedStatus : 200,
      id: check.id,
      timeoutMs: Number.isInteger(check.timeoutMs) ? check.timeoutMs : 15_000,
      url: url.toString(),
    };
  });
}

export async function loadConfig(root, relativePath = "release-proof.config.json") {
  const path = await resolveReadableFileInside(root, relativePath, "config path");
  const source = JSON.parse(await readFile(path, "utf8"));
  const config = {
    ...defaults,
    ...source,
    secretScan: { ...defaults.secretScan, ...(source.secretScan || {}) },
  };

  invariant(config.schemaVersion === 1, "INVALID_CONFIG", "Only configuration schemaVersion 1 is supported");
  invariant(["predeploy", "production"].includes(config.phase), "INVALID_CONFIG", "phase must be predeploy or production");
  invariant(Number.isFinite(config.maxEvidenceAgeMinutes) && config.maxEvidenceAgeMinutes > 0, "INVALID_CONFIG", "maxEvidenceAgeMinutes must be positive");
  invariant(typeof config.requireCleanWorktree === "boolean", "INVALID_CONFIG", "requireCleanWorktree must be boolean");
  invariant(typeof config.wranglerConfig === "string" && config.wranglerConfig.length > 0, "INVALID_CONFIG", "wranglerConfig is required");
  invariant(config.wranglerEnvironment === null || (typeof config.wranglerEnvironment === "string" && config.wranglerEnvironment.length > 0), "INVALID_CONFIG", "wranglerEnvironment must be null or a non-empty string");
  invariant(config.rollbackRecord === null || (typeof config.rollbackRecord === "string" && config.rollbackRecord.length > 0), "INVALID_CONFIG", "rollbackRecord must be null or a relative path");

  config.artifactDirectories = stringArray(config.artifactDirectories, "artifactDirectories");
  config.migrationDirectories = stringArray(config.migrationDirectories, "migrationDirectories");
  config.secretScan.exclude = stringArray(config.secretScan.exclude, "secretScan.exclude");
  config.healthChecks = validateHealthChecks(config.healthChecks);

  if (config.phase === "production") {
    invariant(config.healthChecks.length > 0, "INVALID_CONFIG", "production phase requires at least one health check");
    invariant(config.rollbackRecord !== null, "INVALID_CONFIG", "production phase requires rollbackRecord");
  }
  return config;
}
