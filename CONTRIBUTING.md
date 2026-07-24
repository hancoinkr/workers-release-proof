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

## Changes to the evidence format

Additive optional fields may ship in a minor release. Removing a field,
changing its meaning, or weakening validation requires a new schema version
and migration documentation.
