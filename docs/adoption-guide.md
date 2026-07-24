# Publish an Adoption Receipt

Workers Release Proof counts an adoption only when another person can verify
the public evidence. Stars, package downloads, and private claims are not
treated as adoption.

## 1. Copy the kit

Copy the files from [`templates/adopter-kit`](../templates/adopter-kit):

- `release-proof.config.json` to the repository root;
- `release-proof.yml` to `.github/workflows/release-proof.yml`;
- `receipt.template.json` to a public documentation directory.

Update only public paths, health assertions, and project metadata. Never add
credential values, raw Cloudflare resource IDs, private endpoints, customer
data, or full production responses.

## 2. Prove the pull request

The workflow runs `scan`, `inspect`, and `verify` on every pull request. Keep
the resulting GitHub Actions URL public and tie the action to the exact
Workers Release Proof release.

## 3. Publish postdeploy evidence

After deployment, publish:

- the reviewed Git commit;
- artifact and migration digests;
- sanitized binding counts;
- the public health assertion paths;
- current and previous deployment observations;
- the successful postdeploy workflow URL.

One-way digests are sufficient. Do not publish raw account, database, bucket,
queue, service, or certificate identifiers.

## 4. Register the adoption

Open a
[Public adoption receipt](https://github.com/hancoinkr/workers-release-proof/issues/new?template=adoption.yml)
issue. Select whether the project is independently maintained or affiliated.
The registry will preserve that distinction.

An adoption is accepted only after its source, workflow, and live assertions
can be reproduced without private access.
