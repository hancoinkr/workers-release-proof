# Security Model

## Goal

Detect accidental release drift between reviewed source, built artifacts,
database migrations, Worker configuration structure, live health state, and
rollback metadata.

## Trust boundaries

- Git and the local filesystem are trusted only after explicit validation.
- Configuration is untrusted input.
- Health endpoints are untrusted network input.
- Evidence files are untrusted until their integrity and freshness pass.
- CI logs are public data and must never receive secret values.

## Defenses

- Repository-relative path resolution and symlink rejection.
- Deterministic content digests over file metadata and bytes.
- Clean-worktree enforcement by default.
- Bounded health responses, strict JSON parsing, query-free URLs, redirects
  disabled, and request timeouts.
- Sanitized Wrangler collection that omits values and raw resource identifiers
  while retaining one-way resource-reference digests.
- Secret findings report only rule, path, and line.
- Atomic evidence writes with owner-only permissions where supported.
- Freshness checks for evidence and rollback observations.

## Non-goals

This project does not:

- sign artifacts or replace Sigstore, SLSA provenance, or platform attestations;
- prove that a compromised build host behaved correctly;
- fetch or validate secret values;
- deploy or roll back a Worker;
- claim that a health endpoint is honest;
- scan untracked ignored files when used inside Git.

Use least-privilege CI permissions and combine this gate with protected
branches, code review, platform deployment controls, and artifact signing when
your threat model requires them.
