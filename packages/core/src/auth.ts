import { z } from 'zod';

/**
 * Minimum password length. Keep it in sync with Supabase → Authentication → Providers → Email →
 * "Minimum password length" (README → Authentication), which enforces it server-side.
 */
export const PASSWORD_MIN_LENGTH = 8;

// Trimmed before the format check, so a pasted address with stray spaces is accepted.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address.' }));

const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    error: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  .max(72, { error: 'Use at most 72 characters.' });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export const signUpSchema = z.object({ email, password: newPassword });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    error: 'The passwords do not match.',
    path: ['confirmPassword'],
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
