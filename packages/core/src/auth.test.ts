import { describe, expect, it } from 'vitest';

import {
  forgotPasswordSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './auth';

const password = 'correct-horse-battery';

describe('signInSchema', () => {
  it('accepts an email and password', () => {
    expect(signInSchema.parse({ email: 'ada@example.com', password: 'x' })).toEqual({
      email: 'ada@example.com',
      password: 'x',
    });
  });

  it('rejects an invalid email and an empty password', () => {
    expect(signInSchema.safeParse({ email: 'not-an-email', password: '' }).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('trims and lowercases the email', () => {
    expect(signUpSchema.parse({ email: '  Ada@Example.COM ', password }).email).toBe(
      'ada@example.com',
    );
  });

  it('rejects passwords shorter than the minimum length', () => {
    const result = signUpSchema.safeParse({
      email: 'ada@example.com',
      password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts a valid email and rejects an invalid one', () => {
    expect(forgotPasswordSchema.parse({ email: 'ada@example.com' })).toEqual({
      email: 'ada@example.com',
    });
    expect(forgotPasswordSchema.safeParse({ email: 'ada' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching passwords', () => {
    expect(resetPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(
      true,
    );
  });

  it('reports mismatched passwords on confirmPassword', () => {
    const result = resetPasswordSchema.safeParse({ password, confirmPassword: 'something-else' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword']);
    expect(result.error?.issues[0]?.message).toBe('The passwords do not match.');
  });
});
