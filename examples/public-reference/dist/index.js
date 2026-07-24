// Generated from src/index.js by npm run reference:build.
const jsonHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

function json(payload, status = 200) {
  return new Response(`${JSON.stringify(payload)}\n`, {
    headers: jsonHeaders,
    status,
  });
}

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (url.pathname === "/health") {
      return json({
        data: {
          project: "workers-release-proof-public-reference",
          release: {
            artifactSha256: env.RELEASE_ARTIFACT_SHA256,
            commitSha: env.RELEASE_COMMIT_SHA,
            deploymentVersionId: env.WORKER_VERSION?.id ?? null,
            migrationsSha256: env.RELEASE_MIGRATIONS_SHA256,
          },
          status: "ok",
        },
      });
    }

    if (url.pathname === "/") {
      return json({
        description: "Public, reproducible Cloudflare Workers release-proof reference.",
        health: "/health",
        source: "https://github.com/hancoinkr/workers-release-proof/tree/main/examples/public-reference",
        status: "ok",
      });
    }

    return json({ error: "not_found" }, 404);
  },
};
