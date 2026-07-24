# Compatibility and Support Policy

Workers Release Proof is pre-1.0. Security properties fail closed; convenience
features do not take precedence over release integrity.

## Evidence schemas

- `schemaVersion: 1` is accepted throughout the `0.2.x` line.
- Additive optional fields may be introduced in a minor release.
- Removing a field, changing its meaning, or weakening a validation invariant
  requires a new schema version and migration guide.
- Unknown configuration and evidence schema versions are rejected.

## CLI and action

- Existing commands and flags remain compatible within a minor release line.
- A behavioral deprecation is announced in the changelog and remains
  available for at least one minor release or 90 days, whichever is longer.
- Security fixes may reject input that a previous release accepted when that
  input could bypass a documented invariant.

## Runtime

- Node.js 22 and 24 are tested on every pull request.
- JSON and JSONC Wrangler configuration are supported in `0.2.x`.
- Wrangler binding shapes listed in
  [wrangler-compatibility.md](wrangler-compatibility.md) are covered by public
  fixtures. TOML support is tracked separately and is not yet claimed.

## Release support

The latest minor release receives bug and security fixes. Critical and
high-severity fixes may be backported when a supported release line is still
used by a published, reproducible adoption.

Migration notes, supported runtime changes, and security-relevant behavior
changes are documented in the changelog before release.
