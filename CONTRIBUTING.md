# Contributing

## Ground rules

- Open an issue before a large behavioral change.
- Keep evidence deterministic and credential-free.
- Add a regression test for every bug fix.
- Do not weaken a fail-closed check without documenting the threat-model
  change.
- Never include real credentials, private production responses, customer
  data, or proprietary configuration in issues or fixtures.

## Development

```bash
npm install
npm run check
```

Pull requests must pass the complete check command on Node.js 22.

To publish an independently reproducible integration, start with the
[adopter kit](templates/adopter-kit/README.md) and open a Public adoption
receipt issue after the public workflow passes.

## Changes to the evidence format

Additive optional fields may ship in a minor release. Removing a field,
changing its meaning, or weakening validation requires a new schema version
and migration documentation.

See [docs/compatibility-policy.md](docs/compatibility-policy.md) for the
versioning and deprecation contract.
