# Adopter Kit

Copy this kit into a public Cloudflare Workers repository and follow
[`docs/adoption-guide.md`](../../docs/adoption-guide.md).

The configuration is predeploy-only by default. Add production health and
rollback checks only after the endpoint and deployment observations exist.

Keep credentials, raw resource identifiers, private endpoints, customer data,
and production response bodies out of commits, workflows, issues, and
receipts.
