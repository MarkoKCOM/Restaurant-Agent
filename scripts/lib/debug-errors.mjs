export function errorField(error, field) {
  return error && typeof error === "object" && field in error ? error[field] : undefined;
}

export function sanitizeConnectionCause(cause) {
  if (!cause || typeof cause !== "object") return undefined;

  const causes = Array.isArray(cause.errors)
    ? cause.errors.map((nested) => sanitizeConnectionCause(nested))
    : undefined;

  return {
    name: errorField(cause, "name"),
    message: errorField(cause, "message"),
    code: errorField(cause, "code"),
    syscall: errorField(cause, "syscall"),
    address: errorField(cause, "address"),
    port: errorField(cause, "port"),
    errors: causes?.filter(Boolean),
  };
}

export function sanitizeConnectionError(error) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    cause: sanitizeConnectionCause(errorField(error, "cause")),
  };
}
