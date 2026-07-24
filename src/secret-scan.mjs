import { readFile } from "node:fs/promises";
import { basename, sep } from "node:path";
import { ProofError } from "./errors.mjs";
import { listTrackedFiles } from "./git.mjs";
import { resolveReadableFileInside, walkRegularFiles } from "./path-safety.mjs";

const MAX_SCANNABLE_BYTES = 20 * 1024 * 1024;
const contentRules = [
  { code: "PRIVATE_KEY", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { code: "GITHUB_TOKEN", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { code: "OPENAI_KEY", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { code: "GOOGLE_API_KEY", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/g },
  { code: "SLACK_TOKEN", pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { code: "AWS_ACCESS_KEY", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { code: "TELEGRAM_BOT_TOKEN", pattern: /\b[0-9]{8,10}:AA[A-Za-z0-9_-]{20,}\b/g },
];

const genericAssignment = /\b(password|passwd|secret|token|api[_-]?key|apikey|client[_-]?secret)\b\s*[:=]\s*["']?([^"'\s,;}{]+)/gi;
const placeholder = /^(?:|example|sample|test|testing|dummy|placeholder|changeme|replace[-_]?me|your[-_].*|x{3,}|<.*>|\$\{.*\}|process\.env.*)$/i;

function normalized(path) {
  return path.split(sep).join("/");
}

function isExcluded(path, exclusions) {
  return exclusions.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function sensitivePathCode(path) {
  const name = basename(path).toLowerCase();
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) return "TRACKED_ENV_FILE";
  if (name === ".npmrc" || name === "credentials.json" || name === "id_rsa" || name.endsWith(".pem") || name.endsWith(".key")) return "SENSITIVE_FILE_NAME";
  return null;
}

function lineNumber(source, index) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) if (source.charCodeAt(cursor) === 10) line += 1;
  return line;
}

async function candidateFiles(root) {
  try {
    return listTrackedFiles(root);
  } catch {
    const files = await walkRegularFiles(root, ".", {
      excludeDirectories: [".git", "node_modules", ".release-proof", "coverage"],
    });
    return files.map((file) => file.path);
  }
}

export async function scanSecrets(root, options = {}) {
  const exclusions = (options.exclude || []).map((item) => normalized(item));
  const files = await candidateFiles(root);
  const findings = [];

  for (const relative of files.map(normalized).sort((a, b) => a.localeCompare(b, "en"))) {
    if (isExcluded(relative, exclusions)) continue;
    const pathCode = sensitivePathCode(relative);
    if (pathCode) findings.push({ code: pathCode, file: relative, line: 1 });

    const absolute = await resolveReadableFileInside(root, relative, "tracked file");
    const bytes = await readFile(absolute);
    if (bytes.length > MAX_SCANNABLE_BYTES) {
      findings.push({ code: "FILE_TOO_LARGE_TO_SCAN", file: relative, line: 1 });
      continue;
    }
    if (bytes.includes(0)) continue;
    const source = bytes.toString("utf8");

    for (const rule of contentRules) {
      rule.pattern.lastIndex = 0;
      for (const match of source.matchAll(rule.pattern)) {
        findings.push({ code: rule.code, file: relative, line: lineNumber(source, match.index || 0) });
      }
    }

    genericAssignment.lastIndex = 0;
    for (const match of source.matchAll(genericAssignment)) {
      const value = String(match[2] || "").replace(/[)\]`]+$/, "");
      if (!placeholder.test(value) && value.length >= 8) {
        findings.push({ code: "HARDCODED_CREDENTIAL", file: relative, line: lineNumber(source, match.index || 0) });
      }
    }
  }

  return findings.sort((a, b) => `${a.file}:${a.line}:${a.code}`.localeCompare(`${b.file}:${b.line}:${b.code}`, "en"));
}

export function assertNoSecrets(findings) {
  if (findings.length === 0) return;
  throw new ProofError("SECRET_SCAN_FAILED", `Secret scan found ${findings.length} potential problem(s)`, {
    findings,
  });
}
