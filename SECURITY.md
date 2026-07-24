# Security Policy

## Supported versions

Security fixes are provided for the latest minor release.

## Reporting

After the public repository is created, report vulnerabilities using GitHub
Private Vulnerability Reporting. Do not open a public issue containing a
credential, private endpoint response, exploit, or customer data.

Before publication, report privately to the maintainer through the contact
method listed on the maintainer's verified GitHub profile.

## Scope

High-priority reports include:

- secret values written to evidence or logs;
- path traversal outside the configured repository root;
- symlink escape;
- command execution from untrusted configuration;
- validation bypass for commit, artifact, migration, health, or rollback
  bindings;
- ambiguous or non-deterministic evidence generation.
