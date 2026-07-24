import { execFileSync } from "node:child_process";
import { ProofError, invariant } from "./errors.mjs";

function git(root, args, options = {}) {
  try {
    const output = execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return options.trim === false ? output : output.trim();
  } catch (error) {
    throw new ProofError("GIT_FAILED", `git ${args.join(" ")} failed`, {
      status: typeof error?.status === "number" ? error.status : null,
    });
  }
}

function ignoredPathspec(path) {
  invariant(typeof path === "string" && path.length > 0, "INVALID_GIT_IGNORE_PATH", "Ignored Git path must be a non-empty string");
  const normalized = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
  invariant(!normalized.startsWith("/") && !normalized.split("/").includes(".."), "INVALID_GIT_IGNORE_PATH", "Ignored Git path must stay inside the repository");
  return `:(exclude,top,literal)${normalized}`;
}

export function collectGitState(root, options = {}) {
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  invariant(inside === "true", "NOT_GIT_REPOSITORY", "Repository root is not a Git worktree");
  const commitSha = git(root, ["rev-parse", "HEAD"]);
  invariant(/^[a-f0-9]{40}$/i.test(commitSha), "INVALID_COMMIT", "Git HEAD is not a full commit SHA");
  const ignoredPaths = Array.isArray(options.ignorePaths) ? options.ignorePaths : [];
  const status = git(root, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ".",
    ...ignoredPaths.map(ignoredPathspec),
  ]);
  const dirtyCount = status === "" ? 0 : status.split("\n").length;
  return {
    clean: dirtyCount === 0,
    commitSha,
    dirtyCount,
  };
}

export function listTrackedFiles(root) {
  const output = git(root, ["ls-files", "-z"], { trim: false });
  return output === "" ? [] : output.split("\0").filter(Boolean);
}
