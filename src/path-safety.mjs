import { lstat, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ProofError, invariant } from "./errors.mjs";

export function resolveInside(root, candidate, label = "path") {
  invariant(typeof candidate === "string" && candidate.length > 0, "INVALID_PATH", `${label} must be a non-empty string`);
  invariant(!candidate.includes("\0"), "INVALID_PATH", `${label} contains a null byte`);
  invariant(!isAbsolute(candidate), "ABSOLUTE_PATH_REJECTED", `${label} must be relative to the repository root`);

  const absoluteRoot = resolve(root);
  const absolute = resolve(absoluteRoot, candidate);
  const prefix = `${absoluteRoot}${sep}`;
  invariant(absolute === absoluteRoot || absolute.startsWith(prefix), "PATH_ESCAPE", `${label} escapes the repository root`);
  return absolute;
}

export async function assertNoSymlinkComponents(root, absolute, label = "path") {
  const absoluteRoot = resolve(root);
  const rel = relative(absoluteRoot, absolute);
  invariant(rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel)), "PATH_ESCAPE", `${label} escapes the repository root`);
  const rootMetadata = await lstat(absoluteRoot);
  invariant(!rootMetadata.isSymbolicLink(), "SYMLINK_REJECTED", `Repository root must not be a symlink for ${label}`);

  let current = absoluteRoot;
  const parts = rel === "" ? [] : rel.split(sep);
  for (const part of parts) {
    current = resolve(current, part);
    try {
      const metadata = await lstat(current);
      invariant(!metadata.isSymbolicLink(), "SYMLINK_REJECTED", `Symlinks are not allowed in ${label}: ${relative(absoluteRoot, current)}`);
    } catch (error) {
      if (error?.code === "ENOENT") return absolute;
      throw error;
    }
  }
  return absolute;
}

export async function resolveReadableFileInside(root, candidate, label = "path") {
  const absolute = resolveInside(root, candidate, label);
  await assertNoSymlinkComponents(root, absolute, label);
  const metadata = await lstat(absolute);
  invariant(metadata.isFile(), "UNSUPPORTED_FILE_TYPE", `${label} must be a regular file`);
  return absolute;
}

export async function walkRegularFiles(root, startRelative, options = {}) {
  const absoluteRoot = resolve(root);
  const start = resolveInside(absoluteRoot, startRelative, "configured directory");
  const results = [];
  const exclude = new Set(options.excludeDirectories || []);

  async function visit(absolute) {
    let metadata;
    try {
      metadata = await lstat(absolute);
    } catch (error) {
      throw new ProofError("MISSING_PATH", `Configured path does not exist: ${relative(absoluteRoot, absolute)}`, {
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const rel = relative(absoluteRoot, absolute).split(sep).join("/");
    invariant(!metadata.isSymbolicLink(), "SYMLINK_REJECTED", `Symlinks are not allowed in release inputs: ${rel}`);

    if (metadata.isDirectory()) {
      if (exclude.has(rel) || exclude.has(rel.split("/").at(-1))) return;
      const entries = await readdir(absolute, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
      for (const entry of entries) await visit(resolve(absolute, entry.name));
      return;
    }

    invariant(metadata.isFile(), "UNSUPPORTED_FILE_TYPE", `Unsupported release input: ${rel}`);
    results.push({ absolute, metadata, path: rel });
  }

  await visit(start);
  return results;
}
