export function validateFutureIsoDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("expiresAt must be a valid ISO date string.");
  }

  if (date.getTime() <= Date.now()) {
    throw new Error("expiresAt must be in the future.");
  }

  return date.toISOString();
}
