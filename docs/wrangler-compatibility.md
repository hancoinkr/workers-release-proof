# Wrangler Compatibility

Workers Release Proof `0.2.0` parses JSON and JSONC Wrangler configuration.
The public fixture matrix is tested on Node.js 22 and 24.

| Wrangler structure | Top level | Named environment | Evidence |
| --- | --- | --- | --- |
| D1 databases | yes | yes | binding name, hashed reference |
| R2 buckets | yes | yes | binding name, hashed reference |
| KV namespaces | yes | yes | binding name, hashed reference |
| Service bindings | yes | yes | binding name, hashed reference |
| Queues producers | yes | yes | binding name, hashed reference |
| Analytics Engine | yes | yes | binding name, hashed reference |
| Vectorize | yes | yes | binding name, hashed reference |
| Hyperdrive | yes | yes | binding name, hashed reference |
| mTLS certificates | yes | yes | binding name, hashed reference |
| Durable Objects | yes | yes | binding name, hashed reference |
| Static assets binding | yes | yes | binding name, hashed directory |
| `vars` | yes | yes | names only |
| version metadata | yes | yes | binding name |

Bindings and `vars` are deliberately non-inherited for named environments.
When `wranglerEnvironment` is set, only that environment's bindings and
variables are collected. Compatibility date and flags may fall back to the
top-level configuration.

Known binding containers fail closed when their structure is not the expected
array or object. Raw resource IDs, bucket names, service names, datasets,
certificate IDs, and variable values never appear in evidence.

The tested fixtures are:

- [`test/fixtures/wrangler/full-matrix.jsonc`](../test/fixtures/wrangler/full-matrix.jsonc)
- [`test/fixtures/wrangler/environment-matrix.jsonc`](../test/fixtures/wrangler/environment-matrix.jsonc)

Cloudflare recommends JSONC for new projects and documents bindings and
environment non-inheritance in its
[Wrangler configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/).
