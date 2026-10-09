import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { formFields, invalidFields } from './form-state';

describe('formFields', () => {
  it('reads named text fields and defaults missing ones to an empty string', () => {
    const formData = new FormData();
    formData.set('email', 'ada@example.com');
    formData.set('avatar', new Blob(['png']));
    expect(formFields(formData, ['email', 'password', 'avatar'])).toEqual({
      email: 'ada@example.com',
      password: '',
      avatar: '',
    });
  });
});

describe('invalidFields', () => {
  it('turns a zod error into field errors and keeps the given values', () => {
    const schema = z.object({ email: z.email({ error: 'Enter a valid email address.' }) });
    const result = schema.safeParse({ email: 'ada' });
    expect(result.error).toBeDefined();
    expect(invalidFields(result.error as z.ZodError, { email: 'ada' })).toEqual({
      fieldErrors: { email: ['Enter a valid email address.'] },
      values: { email: 'ada' },
    });
  });
});
