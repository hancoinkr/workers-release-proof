# JSON Schemas

Versioned Draft 2020-12 schemas let editors, CI jobs, and policy tools validate
configuration and evidence shape before invoking the CLI:

- [`schemas/config-v1.schema.json`](../schemas/config-v1.schema.json)
- [`schemas/evidence-v1.schema.json`](../schemas/evidence-v1.schema.json)

Add the local schema to a configuration file:

```json
{
  "$schema": "./node_modules/workers-release-proof/schemas/config-v1.schema.json",
  "schemaVersion": 1
}
```

The schemas reject unknown properties and schema versions. The CLI separately
enforces semantic rules that JSON Schema cannot prove, including path
containment, clean Git state, live response equality, evidence freshness, and
integrity hashes.

CI can validate both documents with any Draft 2020-12 implementation. For
example, with Ajv CLI:

```bash
npx ajv-cli validate \
  -s node_modules/workers-release-proof/schemas/config-v1.schema.json \
  -d release-proof.config.json \
  --spec=draft2020
```

Schemas contain structure only. They intentionally define no field for secret
values.
