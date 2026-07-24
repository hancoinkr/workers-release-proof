import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { createRepository, write } from "./helpers.mjs";

const cli = new URL("../bin/workers-release-proof.mjs", import.meta.url).pathname;

function run(root, args) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("CLI prints help", (t) => {
  const root = createRepository(t);
  const result = run(root, ["help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Workers Release Proof/);
});

test("CLI prints version", (t) => {
  const root = createRepository(t);
  const result = run(root, ["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "0.1.3");
});

test("CLI scan returns machine-readable success", (t) => {
  const root = createRepository(t);
  const result = run(root, ["scan", "--json"]);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { findingCount: 0, result: "pass" });
});

test("CLI inspect and verify form a complete gate", (t) => {
  const root = createRepository(t);
  const inspect = run(root, ["inspect", "--json"]);
  assert.equal(inspect.status, 0, inspect.stderr);
  const inspected = JSON.parse(inspect.stdout);
  assert.equal(inspected.result, "pass");
  const verify = run(root, ["verify", "--json"]);
  assert.equal(verify.status, 0, verify.stderr);
  assert.equal(JSON.parse(verify.stdout).result, "pass");
});

test("CLI returns structured errors without a stack trace", (t) => {
  const root = createRepository(t);
  write(root, "dist/index.js", "dirty\n");
  const result = run(root, ["inspect", "--json"]);
  assert.equal(result.status, 1);
  const output = JSON.parse(result.stderr);
  assert.equal(output.result, "fail");
  assert.equal(output.error.code, "DIRTY_WORKTREE");
  assert.equal(result.stderr.includes("at runCli"), false);
});

test("CLI rejects unknown options", (t) => {
  const root = createRepository(t);
  const result = run(root, ["scan", "--unknown"]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr).error.code, "UNEXPECTED_ERROR");
});
