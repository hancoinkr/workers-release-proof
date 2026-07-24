import { readFile, writeFile } from "node:fs/promises";

const sourceUrl = new URL("../examples/public-reference/src/index.js", import.meta.url);
const outputUrl = new URL("../examples/public-reference/dist/index.js", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const output = `// Generated from src/index.js by npm run reference:build.\n${source}`;

await writeFile(outputUrl, output);
process.stdout.write(`${JSON.stringify({
  output: "examples/public-reference/dist/index.js",
  result: "pass",
})}\n`);
