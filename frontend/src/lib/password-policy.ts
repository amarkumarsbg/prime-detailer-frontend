/** Align copy with backend `validateStrongPassword`. */
export const PASSWORD_POLICY_HINT =
  "At least 8 characters with uppercase, lowercase, a number, and a special character (#@$%&*!?+-).";

export function validateStrongPassword(plain: string): string | null {
  if (plain.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(plain)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(plain)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(plain)) return "Password must include a number.";
  if (!/[#@$%&*!?+-]/.test(plain))
    return "Password must include one of these special characters: # @ $ % & * ! ? + -";
  return null;
}
