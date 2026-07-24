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

export function collectGitState(root) {
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  invariant(inside === "true", "NOT_GIT_REPOSITORY", "Repository root is not a Git worktree");
  const commitSha = git(root, ["rev-parse", "HEAD"]);
  invariant(/^[a-f0-9]{40}$/i.test(commitSha), "INVALID_COMMIT", "Git HEAD is not a full commit SHA");
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
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
