# Workers Release Proof

[![CI](https://github.com/hancoinkr/workers-release-proof/actions/workflows/ci.yml/badge.svg)](https://github.com/hancoinkr/workers-release-proof/actions/workflows/ci.yml)
[![Production reference](https://github.com/hancoinkr/workers-release-proof/actions/workflows/production-reference.yml/badge.svg)](https://github.com/hancoinkr/workers-release-proof/actions/workflows/production-reference.yml)
[![Release](https://img.shields.io/github/v/release/hancoinkr/workers-release-proof)](https://github.com/hancoinkr/workers-release-proof/releases)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-339933.svg)](https://nodejs.org/)

Fail-closed, content-addressed release evidence for Cloudflare Workers.

Workers Release Proof proves that the commit you reviewed, the artifact you
built, the D1 migrations you expected, and the release state you observed are
the same release. It stores hashes and public structure, never credential
values.

> Status: pre-1.0. The evidence format is stable within the `0.1.x` line, but
> the CLI may still add commands before `1.0.0`.

## Why

Normal CI can show that a build succeeded. It does not necessarily prove that:

- the worktree was clean;
- the deployed artifact came from the reviewed commit;
- the migration set was unchanged;
- Worker bindings matched the reviewed configuration;
- a live health endpoint reported the same commit and artifact;
- rollback metadata referred to an actually observed prior release.

Workers Release Proof binds those facts into one deterministic JSON document.
Any missing or mismatched fact fails the gate.

## Features

- deterministic SHA-256 tree digest for build artifacts;
- Git commit and clean-worktree binding;
- D1 migration name, size, and SHA-256 manifest;
- sanitized Wrangler binding inventory with variable names but no values;
- configurable live health assertions using release placeholders;
- rollback metadata validation;
- tracked-file secret scan that reports locations without printing values;
- standalone CLI and composite GitHub Action;
- zero runtime dependencies and Node.js 22+.

## Quick start

```bash
npm install --save-dev \
  https://github.com/hancoinkr/workers-release-proof/releases/download/v0.1.3/workers-release-proof-0.1.3.tgz
cp node_modules/workers-release-proof/release-proof.config.example.json \
  release-proof.config.json
npx workers-release-proof scan
npx workers-release-proof inspect
npx workers-release-proof verify
```

The default evidence file is `.release-proof/evidence.json`.

The package is currently distributed from pinned HTTPS GitHub release
tarballs, not the npm registry. This avoids requiring GitHub SSH credentials
and records an integrity value in `package-lock.json`. Release tarballs receive
a public GitHub artifact attestation.

## Configuration

```json
{
  "schemaVersion": 1,
  "artifactDirectories": ["dist", ".wrangler/dry-run"],
  "migrationDirectories": ["migrations"],
  "wranglerConfig": "wrangler.jsonc",
  "wranglerEnvironment": "production",
  "maxEvidenceAgeMinutes": 60,
  "requireCleanWorktree": true,
  "healthChecks": [
    {
      "id": "worker-health",
      "url": "https://example.com/api/health",
      "expectedStatus": 200,
      "assertions": [
        { "path": "status", "equals": "ok" },
        { "path": "release.commitSha", "equals": "$commitSha" },
        {
          "path": "release.artifactSha256",
          "equals": "$artifactSha256"
        }
      ]
    }
  ],
  "secretScan": {
    "exclude": ["test/fixtures/"]
  }
}
```

`$commitSha` and `$artifactSha256` resolve from the candidate release. Health
responses are hashed; response bodies are not written to the evidence file.
Set `wranglerEnvironment` when deploying with Wrangler `--env`; bindings are
resolved from that named environment and raw resource identifiers remain
private.

## Commands

```text
workers-release-proof scan
workers-release-proof inspect
workers-release-proof verify
workers-release-proof help
```

Common flags:

```text
--root <path>       Repository root
--config <path>     Configuration path
--evidence <path>   Evidence path
--json              Machine-readable output
```

## GitHub Action

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
- uses: hancoinkr/workers-release-proof@v0.1.3
  with:
    config: release-proof.config.json
```

The action scans tracked files, creates evidence from the checked-out commit,
and immediately verifies it.

## Production reference

The first maintainer-operated production adoption validates a 245-file Worker
artifact set, 27 D1 migrations, sanitized Wrangler structure, and a public
health endpoint for [BitcoinKevin](https://bitcoinkevin.com/). A public,
redacted receipt and scheduled live verification are documented in
[docs/production-reference.md](docs/production-reference.md).

This is first-party production use, not independent third-party adoption. The
distinction is kept explicit until another maintainer publishes a reproducible
integration.

## Security properties

- Environment-variable values are never read for evidence generation.
- Wrangler `vars` are recorded by key only.
- D1, R2, KV, service, queue, and analytics bindings are recorded by binding
  name and type only.
- URLs are stripped of credentials before storage.
- Secret findings include rule, file, and line only.
- A dirty worktree, changed artifact, changed migration, stale evidence,
  missing health assertion, or rollback mismatch fails closed.

Read [docs/security-model.md](docs/security-model.md) before using the tool in
a production release workflow.

## Project origin

The design was generalized from a production Cloudflare Workers release
pipeline that bound source commits, build artifacts, D1 migrations, live
health, and rollback evidence. Product-specific names, IDs, monetization,
payment, user, and operator logic are intentionally excluded from this
repository.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[GOVERNANCE.md](GOVERNANCE.md). Planned work is tracked in
[ROADMAP.md](ROADMAP.md).

## License

Apache-2.0
