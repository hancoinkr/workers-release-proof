# Workers Release Proof

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
npm install --save-dev workers-release-proof
cp node_modules/workers-release-proof/release-proof.config.example.json \
  release-proof.config.json
npx workers-release-proof scan
npx workers-release-proof inspect
npx workers-release-proof verify
```

The default evidence file is `.release-proof/evidence.json`.

## Configuration

```json
{
  "schemaVersion": 1,
  "artifactDirectories": ["dist", ".wrangler/dry-run"],
  "migrationDirectories": ["migrations"],
  "wranglerConfig": "wrangler.jsonc",
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
- uses: hancoinkr/workers-release-proof@v0
  with:
    config: release-proof.config.json
```

The action scans tracked files, creates evidence from the checked-out commit,
and immediately verifies it.

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
[GOVERNANCE.md](GOVERNANCE.md).

## License

Apache-2.0
