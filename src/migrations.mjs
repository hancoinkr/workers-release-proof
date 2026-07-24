import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { invariant } from "./errors.mjs";
import { walkRegularFiles } from "./path-safety.mjs";

export async function collectMigrations(root, directories) {
  invariant(Array.isArray(directories), "INVALID_MIGRATION_DIRECTORIES", "migrationDirectories must be an array");
  const records = [];
  const seen = new Set();

  for (const directory of directories) {
    const files = await walkRegularFiles(root, directory);
    const sqlFiles = files.filter((file) => file.path.toLowerCase().endsWith(".sql"));
    invariant(sqlFiles.length > 0, "EMPTY_MIGRATION_DIRECTORY", `No SQL migrations found in ${directory}`);
    for (const file of sqlFiles) {
      invariant(!seen.has(file.path), "DUPLICATE_MIGRATION", `Migration is included more than once: ${file.path}`);
      seen.add(file.path);
      const bytes = await readFile(file.absolute);
      records.push({
        path: file.path,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
      });
    }
  }

  records.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const digest = createHash("sha256");
  for (const record of records) {
    digest.update(record.path);
    digest.update("\0");
    digest.update(String(record.size));
    digest.update("\0");
    digest.update(record.sha256);
    digest.update("\0");
  }

  return {
    algorithm: "sha256-migration-manifest-v1",
    count: records.length,
    files: records,
    sha256: digest.digest("hex"),
  };
}
