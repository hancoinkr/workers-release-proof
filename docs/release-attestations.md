# Verify Release Attestations

Release tarballs include a SHA-256 checksum and GitHub artifact attestation.
Download both assets from the same release before installation.

## Linux

```bash
sha256sum --check workers-release-proof-0.2.0.tgz.sha256
```

## macOS

```bash
expected="$(cut -d ' ' -f 1 workers-release-proof-0.2.0.tgz.sha256)"
actual="$(shasum -a 256 workers-release-proof-0.2.0.tgz | cut -d ' ' -f 1)"
test "$actual" = "$expected"
```

## GitHub provenance

```bash
gh attestation verify workers-release-proof-0.2.0.tgz \
  --repo hancoinkr/workers-release-proof \
  --signer-workflow \
    hancoinkr/workers-release-proof/.github/workflows/release.yml \
  --cert-oidc-issuer https://token.actions.githubusercontent.com \
  --deny-self-hosted-runners
```

The expected predicate is SLSA provenance v1. The certificate must identify
GitHub Actions' OIDC issuer, this repository, and the pinned release workflow.
The release job runs on a GitHub-hosted runner.

To demonstrate failure safely, copy the tarball, modify the copy, and rerun
both checks:

```bash
cp workers-release-proof-0.2.0.tgz modified.tgz
printf x >> modified.tgz
shasum -a 256 modified.tgz
gh attestation verify modified.tgz \
  --repo hancoinkr/workers-release-proof
```

Neither the checksum nor the attestation should verify the modified artifact.
GitHub's
[artifact-attestation documentation](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds)
describes the certificate and predicate checks.
