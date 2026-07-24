# Production Reference

Workers Release Proof is used by its lead maintainer against the private
release checkout for [BitcoinKevin](https://bitcoinkevin.com/), a production
Cloudflare Workers application.

The first integration run exposed two real defects before public release
`0.1.3`:

1. generic secret detection treated runtime variables and fake test values as
   hardcoded credentials;
2. a generated evidence file could make the next verification report a dirty
   worktree when the consumer had not ignored that exact output path.

Both defects now have regression tests. The successful rerun covered:

- 245 built Worker files;
- 27 D1 migrations;
- two sanitized resource bindings and nine variable names;
- a public health assertion bound to the deployed Git commit;
- live D1 and R2 service availability;
- an integrity-bound evidence receipt.

The redacted receipt is
[docs/adoption/bitcoinkevin.json](adoption/bitcoinkevin.json). The scheduled
`Production reference` workflow independently checks its public health
assertions without credentials.

## Limits

- This is first-party production use by the lead maintainer, not independent
  third-party adoption.
- The application source and full evidence document are private. The receipt
  publishes only counts and one-way digests.
- The existing production application and Workers Release Proof use different
  artifact-tree canonicalization, so this receipt does not claim that their
  artifact digests are equal.
- The scheduled workflow checks the public deployment fields. It cannot
  reproduce the private source, artifact, or migration collection.
