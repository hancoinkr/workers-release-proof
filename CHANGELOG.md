# Changelog

## 0.2.0 - 2026-07-24

- Published Draft 2020-12 schemas for configuration and evidence.
- Added a fully public Cloudflare Worker source, deterministic build, live
  endpoint, and scheduled postdeploy receipt verification.
- Added a tested Wrangler binding matrix, static assets evidence, and
  fail-closed rejection of malformed known binding structures.
- Documented exact checksum and GitHub artifact-attestation verification.

## 0.1.3 - 2026-07-24

- Fixed generic credential scanning to evaluate literal assignments without
  treating runtime variable references as hardcoded secrets.
- Kept provider-specific secret rules active inside tests while suppressing
  fake test-value noise from the generic rule.
- Excluded only the selected generated evidence file from Git dirty-state
  comparison so `inspect` and `verify` work without a `.gitignore` rule.
- Added 55 regression tests and a redacted, scheduled production reference.

## 0.1.2 - 2026-07-24

- Replaced unavailable npm-registry instructions with a pinned GitHub install.
- Pinned the documented GitHub Action to an existing release.
- Added release tarballs with GitHub artifact attestations.
- Added CODEOWNERS, Dependabot, and a public roadmap.
- Pinned workflow actions to reviewed full commit SHAs.
- Bound sanitized Wrangler evidence to named environments and hashed resource
  references.

## 0.1.1 - 2026-07-24

- Restored the canonical Apache-2.0 license text.
- Updated official GitHub Actions to their Node.js 24 runtime releases.

## 0.1.0 - 2026-07-24

- Initial deterministic artifact and migration evidence.
- Sanitized Wrangler binding inventory.
- Live health and rollback validation.
- Credential-safe tracked-file scanning.
- Composite GitHub Action.
