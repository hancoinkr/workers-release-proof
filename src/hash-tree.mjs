import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { walkRegularFiles } from "./path-safety.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function hashDirectories(root, directories) {
  invariant(Array.isArray(directories) && directories.length > 0, "NO_ARTIFACT_DIRECTORIES", "At least one artifact directory is required");
  const records = [];
  const seen = new Set();

  for (const directory of directories) {
    const files = await walkRegularFiles(root, directory);
    for (const file of files) {
      invariant(!seen.has(file.path), "DUPLICATE_ARTIFACT", `Artifact is included more than once: ${file.path}`);
      seen.add(file.path);
      const bytes = await readFile(file.absolute);
      records.push({
        mode: file.metadata.mode & 0o777,
        path: file.path,
        sha256: sha256(bytes),
        size: bytes.length,
      });
    }
  }

  records.sort((a, b) => a.path.localeCompare(b.path, "en"));
  invariant(records.length > 0, "EMPTY_ARTIFACT", "Configured artifact directories contain no files");
  const digest = createHash("sha256");
  for (const record of records) {
    digest.update(record.path);
    digest.update("\0");
    digest.update(String(record.mode));
    digest.update("\0");
    digest.update(String(record.size));
    digest.update("\0");
    digest.update(record.sha256);
    digest.update("\0");
  }

  return {
    algorithm: "sha256-tree-v1",
    fileCount: records.length,
    files: records,
    sha256: digest.digest("hex"),
    totalBytes: records.reduce((sum, record) => sum + record.size, 0),
  };
}
