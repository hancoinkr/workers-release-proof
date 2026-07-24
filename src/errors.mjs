export class ProofError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ProofError";
    this.code = code;
    this.details = details;
  }
}

export function invariant(condition, code, message, details = undefined) {
  if (!condition) throw new ProofError(code, message, details);
}

export function serializeError(error) {
  if (error instanceof ProofError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}
