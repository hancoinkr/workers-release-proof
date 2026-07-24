# Security Policy

## Supported versions

Security fixes are provided for the latest minor release. Critical and
high-severity fixes may be backported when a supported release line has a
published, reproducible adoption.

## Reporting

Use
[GitHub Private Vulnerability Reporting](https://github.com/hancoinkr/workers-release-proof/security/advisories/new).
Do not open a public issue containing a credential, private endpoint response,
exploit, or customer data.

## Response targets

- acknowledge a complete private report within three business days;
- complete initial severity and reproducibility triage within seven calendar
  days;
- target a coordinated critical fix within 14 days and high-severity fix
  within 30 days;
- publish a regression test and advisory with the fix when disclosure is safe.

These are maintainer targets, not guaranteed service-level agreements.
Incomplete reports or coordinated disclosure constraints may require more
time. The reporter receives an updated timeline through the private advisory.

## Scope

High-priority reports include:

- secret values written to evidence or logs;
- path traversal outside the configured repository root;
- symlink escape;
- command execution from untrusted configuration;
- validation bypass for commit, artifact, migration, health, or rollback
  bindings;
- ambiguous or non-deterministic evidence generation.
