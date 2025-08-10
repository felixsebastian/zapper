export function isValidName(name: string): boolean {
  if (typeof name !== "string") return false;
  return /^[A-Za-z-]+$/.test(name);
}

export function assertValidName(name: string, context: string): void {
  if (!isValidName(name)) {
    throw new Error(
      `${context} name '${name}' is invalid. Only letters and hyphens are allowed`,
    );
  }
}
