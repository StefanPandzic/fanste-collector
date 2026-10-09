export * from './clients';
export * from './config';
export type * from './database.types';
// Re-exported so apps can type auth data without depending on `@supabase/supabase-js` directly.
export type { EmailOtpType, JwtPayload, Session, User } from '@supabase/supabase-js';
