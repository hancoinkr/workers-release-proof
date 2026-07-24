# Architecture

Workers Release Proof has one directional data flow:

```text
Git + artifacts + migrations + Wrangler structure
                    |
                    v
             deterministic state
                    |
       health and rollback validation
                    |
                    v
          integrity-bound evidence JSON
```

## Collection

The collector reads only repository paths declared by configuration. It rejects
absolute paths, traversal outside the repository, symlinks, unsupported file
types, empty artifact sets, and duplicate inputs.

Artifact and migration files are represented by path, byte length, and SHA-256.
The final digest also includes those properties, so renaming or replacing a
file changes the result.

## Sanitization

Wrangler configuration is parsed as JSONC. The evidence contains binding types,
binding names, compatibility settings, variable names, and a manifest digest.
It does not contain identifiers, routes, variable values, or environment
values.

## Observation

Health checks perform credential-free HTTP GET requests. Assertions may bind
response fields to the candidate Git commit, artifact digest, or migration
digest. Only assertion results, status, and a response digest are retained.

A production policy may require a recent rollback record naming distinct
current and previous deployments and matching all candidate release digests.

## Verification

Evidence receives a final integrity digest. Verification checks freshness,
recollects the current state, repeats health checks, and compares the release
contract. Any missing, stale, dirty, or mismatched state terminates with a
non-zero status.
