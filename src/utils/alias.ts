const CUSTOM_ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateCustomAlias(alias: string): string {
  const trimmed = alias.trim();

  if (!CUSTOM_ALIAS_PATTERN.test(trimmed)) {
    throw new Error("Custom aliases must be 3-32 characters using letters, numbers, hyphens, or underscores.");
  }

  return trimmed;
}
