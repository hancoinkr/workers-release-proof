import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const ajv = new Ajv2020({
  allErrors: true,
  formats: {
    "date-time": true,
    uri: true,
  },
  strict: true,
});

const validateConfig = ajv.compile(readJson("../schemas/config-v1.schema.json"));
const validateEvidence = ajv.compile(readJson("../schemas/evidence-v1.schema.json"));

test("published configuration schema accepts the valid fixture", () => {
  assert.equal(validateConfig(readJson("./fixtures/schemas/valid-config.json")), true, JSON.stringify(validateConfig.errors));
});

test("published configuration schema rejects unknown versions", () => {
  assert.equal(validateConfig(readJson("./fixtures/schemas/invalid-config-version.json")), false);
});

test("published evidence schema accepts the valid fixture", () => {
  assert.equal(validateEvidence(readJson("./fixtures/schemas/valid-evidence.json")), true, JSON.stringify(validateEvidence.errors));
});

test("published evidence schema rejects unknown properties", () => {
  assert.equal(validateEvidence(readJson("./fixtures/schemas/invalid-evidence-extra-property.json")), false);
});
