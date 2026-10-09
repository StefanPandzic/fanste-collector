# FC-30 — Auth provider setup (Supabase dashboard + Google Cloud)

**Phase:** 5 — Post-v1 follow-ups · **Depends on:** FC-06 · **Platforms:** backend

## Goal
Finish the manual Supabase Auth configuration that FC-06 left out of code: the auth code (web + desktop) is done, but
the providers, mail delivery and redirect URLs are dashboard settings, not migrations. Moved here from FC-06 so
Phase 1 could close.

## Subtasks
Do each item on the dev project; repeat on prod once it exists (FC-29). Steps: README → Authentication setup.

- [ ] Enable the email provider (email confirmation on) and paste the templates from `supabase/templates/`
- [ ] Configure custom SMTP (the built-in Supabase mailer is heavily rate-limited on the free tier)
- [ ] Google OAuth: create a Google Cloud OAuth client (web), set up the consent screen, add the credentials to Supabase
- [ ] Redirect URL allow-list: localhost, production web URL, `fanste://auth/callback` (desktop)

## Acceptance criteria
- A user can create an account with email (confirmation mail arrives via custom SMTP) and sign in on web and desktop
  with the same credentials.
- Google sign-in works in the browser and in the desktop app.

## Notes
- Until this is done, Google sign-in fails and email confirmation depends on the dashboard defaults.
