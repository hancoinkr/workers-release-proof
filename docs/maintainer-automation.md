# Maintainer Automation

The repository is designed for reviewable, low-risk maintainer automation.

## Pull requests

Run `npm run check` on every pull request. The check validates project
structure, JavaScript syntax, tests, the example scan, and the npm package
contents.

## Candidate release

After a reproducible build:

```bash
npx workers-release-proof scan --json
npx workers-release-proof inspect --json
npx workers-release-proof verify --json
```

Archive `.release-proof/evidence.json` with the release job or attestation. Do
not commit live evidence; it is time-bound and repository-specific.

## Production release

Set `phase` to `production`, provide at least one health assertion, and provide
a recent rollback record. The gate then fails unless live state and rollback
state match the exact candidate.

## Issue triage

Label reports as `bug`, `enhancement`, `security`, or `documentation`.
Credential exposure, path escape, evidence leakage, and validation bypass are
security issues and should use private vulnerability reporting.

## Release checklist

1. Review every evidence-schema change.
2. Run CI on supported Node.js versions.
3. Confirm package contents with `npm pack --dry-run`.
4. Update `CHANGELOG.md`.
5. Create a signed or verified tag.
6. Publish from a protected environment with provenance enabled.
