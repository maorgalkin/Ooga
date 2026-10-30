# Sign-in emails (Supabase Auth)

Supabase sends the sign-up confirmation and password-reset emails, from templates set in the dashboard, not in this repo. A project has one template per email, so each template here carries both languages and picks one per person.

| Email | Dashboard template | File |
|---|---|---|
| Confirm your account | Authentication → Emails → **Confirm signup** | [`auth-emails/confirm-signup.html`](auth-emails/confirm-signup.html) |
| Reset your password | Authentication → Emails → **Reset password** | [`auth-emails/reset-password.html`](auth-emails/reset-password.html) |

## How the language is chosen

The templates read the account's metadata (`{{ .Data }}`, Supabase's copy of `user_metadata`):

- **Hebrew** when `language` is `he`. Sign-up saves it when Hebrew is showing (`signUp` in `src/contexts/AuthContext.tsx`), and the Language setting saves it later (`docs/I18N.md`), so the confirmation email of a Hebrew sign-up is Hebrew, and so is a reset for anyone who chose Hebrew.
- **English** otherwise, including every account from before Hebrew (no `language` saved).

The emails greet without a name on purpose: whoever signs up chooses the name, and the confirmation goes to an address nobody has confirmed yet, so a name field could carry someone else's words ("your account is locked, call…") inside a real Ooga email. Keep user-provided metadata out of these templates.

The check is `{{ if and .Data.language (eq .Data.language "he") }}`: comparing a missing value directly can make the template fail to render, which would break the email for everyone without a saved language. Keep the `and`.

The same saved language names a new household in Hebrew (migration 040).

## Updating the templates

1. Supabase dashboard → Authentication → Emails → the template from the table.
2. **Subject:**
   - Confirm signup: `Confirm your Ooga account · אישור החשבון ב־Ooga`
   - Reset password: `Reset your Ooga password · איפוס הסיסמה ב־Ooga`

   Both languages, because the subject may not support the same template logic. If the dashboard's preview shows template tags working in the subject, `{{ if and .Data.language (eq .Data.language "he") }}…{{ else }}…{{ end }}` there too gives one language.
3. **Body:** paste the whole file (the comment line on top is fine to keep).
4. Before saving, send yourself both versions: sign up (or request a reset) once with the app in English and once in Hebrew (`VITE_ENABLE_HEBREW=1` locally, against the test project), and check that the English one renders for an account without a saved language.
5. Save. Edit the file here first and paste again for any later change, so the repo stays the source of truth.

Copy rules: `microcopy` skill (English) and `microcopy/hebrew.md` (Hebrew).
