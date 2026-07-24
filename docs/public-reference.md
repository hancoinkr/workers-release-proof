# Public Cloudflare Worker Reference

The repository contains the complete source, deterministic build output,
Wrangler configuration, migration fixture, predeploy proof, and live
postdeploy receipt for a minimal Cloudflare Worker:

- source: [`examples/public-reference/src/index.js`](../examples/public-reference/src/index.js)
- build output: [`examples/public-reference/dist/index.js`](../examples/public-reference/dist/index.js)
- Wrangler config: [`examples/public-reference/wrangler.jsonc`](../examples/public-reference/wrangler.jsonc)
- migration: [`examples/public-reference/migrations/0001_release_observations.sql`](../examples/public-reference/migrations/0001_release_observations.sql)
- public receipt: [`docs/adoption/public-reference.json`](adoption/public-reference.json)

No D1 database, paid resource, credential, or private source is required to
reproduce the build and predeploy proof:

```bash
npm ci
npm run reference:build
git diff --exit-code -- examples/public-reference/dist/index.js
node bin/workers-release-proof.mjs inspect \
  --root examples/public-reference \
  --config release-proof.config.json \
  --json
node bin/workers-release-proof.mjs verify \
  --root examples/public-reference \
  --config release-proof.config.json \
  --json
```

The `Public reference predeploy proof` CI job runs those gates on every pull
request. The scheduled `Public Worker reference` workflow checks the deployed
health response against the committed receipt without Cloudflare credentials.

The deployment exposes only public release identifiers: Git commit, artifact
digest, migration digest, and Cloudflare deployment version ID. A generated,
gitignored rollback record binds the current and previous deployment IDs to
the same release.

## Failure demonstrations

- Modify `dist/index.js`: verification fails with `ARTIFACT_MISMATCH`.
- Modify a migration: verification fails with `MIGRATIONS_MISMATCH`.
- Change a release field returned by `/health`: production verification fails
  with `HEALTH_ASSERTION_FAILED`.
- Change either deployment ID in the rollback record: verification fails with
  a rollback mismatch or invalid-record error.

These cases are covered by automated artifact, migration, health, integrity,
and rollback regression tests.
