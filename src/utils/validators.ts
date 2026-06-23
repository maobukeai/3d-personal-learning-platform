/**
 * Form validation helpers for email, base32 keys, and required inputs.
 */

/**
 * Validates if a string is a valid email address.
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates if a clean string is in valid Base32 format.
 * (Allows A-Z and 2-7 after stripping spaces and equal padding signs)
 */
export function validateBase32(secret: string): boolean {
  if (!secret) return false;
  const clean = secret.replace(/[\s=]/g, '').toUpperCase();
  const base32Regex = /^[A-Z2-7]+$/;
  return base32Regex.test(clean);
}

/**
 * Checks if a string value is not empty (excluding whitespace).
 */
export function validateRequired(val: string | null | undefined): boolean {
  if (val === null || val === undefined) return false;
  return val.trim().length > 0;
}
