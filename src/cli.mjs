import { resolve } from "node:path";
import { buildEvidence, readEvidence, writeEvidence } from "./evidence.mjs";
import { loadConfig } from "./config.mjs";
import { serializeError } from "./errors.mjs";
import { scanSecrets } from "./secret-scan.mjs";
import { verifyEvidence } from "./verify.mjs";

const help = `Workers Release Proof 0.1.2

Usage:
  workers-release-proof scan [options]
  workers-release-proof inspect [options]
  workers-release-proof verify [options]

Options:
  --root <path>       Repository root (default: current directory)
  --config <path>     Config relative to root (default: release-proof.config.json)
  --evidence <path>   Evidence relative to root (default: .release-proof/evidence.json)
  --json              Print machine-readable output
  --version           Print version
  --help              Print help
`;

function parseArguments(argv) {
  const options = {
    command: "help",
    config: "release-proof.config.json",
    evidence: ".release-proof/evidence.json",
    json: false,
    root: process.cwd(),
  };
  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) options.command = args.shift();

  while (args.length > 0) {
    const flag = args.shift();
    if (flag === "--json") options.json = true;
    else if (flag === "--help" || flag === "-h") options.command = "help";
    else if (flag === "--version" || flag === "-v") options.command = "version";
    else if (["--root", "--config", "--evidence"].includes(flag)) {
      const value = args.shift();
      if (!value) throw new Error(`${flag} requires a value`);
      options[flag.slice(2)] = value;
    } else {
      throw new Error(`Unknown option: ${flag}`);
    }
  }
  options.root = resolve(options.root);
  return options;
}

function printResult(value, json) {
  if (json) process.stdout.write(`${JSON.stringify(value)}\n`);
  else {
    for (const [key, item] of Object.entries(value)) process.stdout.write(`${key}: ${item}\n`);
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArguments(argv);
    if (options.command === "help") {
      process.stdout.write(help);
      return 0;
    }
    if (options.command === "version") {
      process.stdout.write("0.1.2\n");
      return 0;
    }
    const config = await loadConfig(options.root, options.config);

    if (options.command === "scan") {
      const findings = await scanSecrets(options.root, config.secretScan);
      if (findings.length > 0) {
        printResult({ findingCount: findings.length, findings, result: "fail" }, true);
        return 1;
      }
      printResult({ findingCount: 0, result: "pass" }, options.json);
      return 0;
    }

    if (options.command === "inspect") {
      const evidence = await buildEvidence(options.root, config);
      await writeEvidence(options.root, options.evidence, evidence);
      printResult({
        artifactSha256: evidence.artifact.sha256,
        commitSha: evidence.repository.commitSha,
        evidence: options.evidence,
        evidenceSha256: evidence.integrity.sha256,
        result: "pass",
      }, options.json);
      return 0;
    }

    if (options.command === "verify") {
      const evidence = await readEvidence(options.root, options.evidence);
      const result = await verifyEvidence(options.root, config, evidence);
      printResult(result, options.json);
      return 0;
    }

    throw new Error(`Unknown command: ${options.command}`);
  } catch (error) {
    const serialized = serializeError(error);
    process.stderr.write(`${JSON.stringify({ error: serialized, result: "fail" })}\n`);
    return 1;
  }
}
