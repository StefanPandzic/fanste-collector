# FC-06 — Authentication

**Phase:** 1 — Foundation · **Depends on:** FC-02, FC-03, FC-05 · **Platforms:** web, desktop

## Goal
Implement sign-up / sign-in with **email + password** and **Google OAuth** in the web app and the Electron desktop
app using Supabase Auth (SRS §3.1). Apple sign-in is optional for v1 (see Notes).

## Subtasks
### Supabase config (dev + prod projects)
- [ ] Enable email provider (email confirmation on), configure email templates with Fanste Collector branding
- [ ] Configure custom SMTP (the built-in Supabase mailer is heavily rate-limited on the free tier)
- [ ] Google OAuth: create a Google Cloud OAuth client (web), set up the consent screen, add credentials to Supabase
- [ ] Redirect URL allow-list: localhost, production web URL, `fanste://auth/callback` (desktop)

### Web (Next.js)
- [ ] Sign-in, sign-up, forgot-password, reset-password pages
- [ ] `/auth/callback` route handler exchanging the code for a session (PKCE)
- [ ] Middleware refreshing the session and protecting `(app)` routes
- [ ] Sign-out in the user menu

### Desktop (Electron)
- [ ] Email/password works as-is inside the web view
- [ ] OAuth: open the provider URL in the system browser, receive `fanste://auth/callback?code=...` via the protocol handler, forward it to the renderer, and exchange the code for a session
- [ ] Handle Windows (`second-instance` argv) and macOS (`open-url`) deep-link delivery

### Shared
- [ ] `useSession()` / `useUser()` hooks
- [ ] Profile settings page: display name, avatar, default currency; delete account

## Acceptance criteria
- A user can create an account with email and sign in on web and desktop with the same credentials.
- Google sign-in works in the browser and in the desktop app.
- Unauthenticated access to app routes redirects to sign-in.
- A new user automatically gets a `profiles` row.

## Notes
- **Apple sign-in (optional):** the SRS lists it, but it needs a paid Apple Developer account (Services ID + key). With the mobile app and Apple store deployment out of scope, v1 ships email + Google; add Apple later if an account is available.
