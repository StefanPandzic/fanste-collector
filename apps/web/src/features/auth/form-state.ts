import { z } from 'zod';

/** Result of an auth/profile Server Action, rendered by its form via `useActionState`. */
export interface FormState {
  /** Message for the whole form. */
  error?: string;
  /** Messages per field name. */
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Shown instead of (or above) the form after a successful submit. */
  success?: string;
  /**
   * Submitted values to put back into the form, which React resets after every action. Never
   * include passwords.
   */
  values?: Partial<Record<string, string>>;
}

/** Turns a failed zod parse into field errors for {@link FormState}. */
export function invalidFields(error: z.ZodError, values?: FormState['values']): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors, ...(values && { values }) };
}

/** Reads the named text fields of a form; missing fields become `''`. */
export function formFields<K extends string>(
  formData: FormData,
  names: readonly K[],
): Record<K, string> {
  const fields = {} as Record<K, string>;
  for (const name of names) {
    const value = formData.get(name);
    fields[name] = typeof value === 'string' ? value : '';
  }
  return fields;
}
