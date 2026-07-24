import { ProofError } from "./errors.mjs";

function stripComments(input) {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        output += char;
      } else {
        output += " ";
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        output += "  ";
        blockComment = false;
        index += 1;
      } else {
        output += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
    } else if (char === "/" && next === "/") {
      lineComment = true;
      output += "  ";
      index += 1;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      output += "  ";
      index += 1;
    } else {
      output += char;
    }
  }

  if (blockComment) throw new ProofError("INVALID_JSONC", "Unterminated block comment");
  return output;
}

function stripTrailingCommas(input) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(input[lookahead] || "")) lookahead += 1;
      if (input[lookahead] === "}" || input[lookahead] === "]") continue;
    }
    output += char;
  }
  return output;
}

export function parseJsonc(input, label = "JSONC") {
  try {
    return JSON.parse(stripTrailingCommas(stripComments(input)));
  } catch (error) {
    if (error instanceof ProofError) throw error;
    throw new ProofError("INVALID_JSONC", `${label} could not be parsed`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
