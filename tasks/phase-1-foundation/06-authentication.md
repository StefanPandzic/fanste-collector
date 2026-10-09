# FC-06 — Authentication

**Phase:** 1 — Foundation · **Depends on:** FC-02, FC-03, FC-05 · **Platforms:** web, desktop

## Goal
Implement sign-up / sign-in with **email + password** and **Google OAuth** in the web app and the Electron desktop
app using Supabase Auth (SRS §3.1). Apple sign-in is optional for v1 (see Notes).

## Subtasks
### Supabase config (dev + prod projects)
- [x] Email templates with Fanste Collector branding — done in `supabase/templates/` (links go to `/auth/confirm`)
- [x] ~~Manual dashboard setup: enable the email provider and paste the templates, custom SMTP, Google OAuth client, redirect URL allow-list~~ — moved to [FC-30](../phase-5-post-v1/30-auth-provider-setup.md)

### Web (Next.js)
- [x] Sign-in, sign-up, forgot-password, reset-password pages
- [x] `/auth/callback` route handler exchanging the code for a session (PKCE), plus `/auth/confirm` for email links (`token_hash`, works across devices)
- [x] Middleware refreshing the session and protecting `(app)` routes — `src/proxy.ts` (Next.js 16 renamed middleware to proxy), plus `requireUser()` in the `(app)` layout
- [x] Sign-out in the user menu

### Desktop (Electron)
- [x] Email/password works as-is inside the web view
- [x] OAuth: open the provider URL in the system browser, receive `fanste://auth/callback?code=...` via the protocol handler, forward it to the renderer, and exchange the code for a session — the main process loads `<web origin>/auth/callback?code=…` in the window (`authCallbackUrl()`), no bridge change
- [x] Handle Windows (`second-instance` argv) and macOS (`open-url`) deep-link delivery, including links that arrive before the window exists

### Shared
- [x] `useSession()` / `useUser()` hooks (`features/auth/session-provider.tsx`)
- [x] Profile settings page: display name, avatar (upload to the `avatars` Storage bucket, migration `avatars_bucket`), default currency; delete account (Server Action + admin API)

## Acceptance criteria
- A user can create an account with email and sign in on web and desktop with the same credentials.
- Google sign-in works in the browser and in the desktop app.
- Unauthenticated access to app routes redirects to sign-in.
- A new user automatically gets a `profiles` row.

## Notes
- **Apple sign-in (optional):** the SRS lists it, but it needs a paid Apple Developer account (Services ID + key). With the mobile app and Apple store deployment out of scope, v1 ships email + Google; add Apple later if an account is available.
