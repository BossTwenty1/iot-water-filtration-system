# Password recovery

Users can recover an existing account without knowing the old password or
waiting for an administrator. They must have access to the account's email.

1. Choose **Forgot password?** on the sign-in page.
2. Enter the account email and choose **Send reset link**.
3. Open the reset email and follow its link.
4. Enter and confirm a new password, then choose **Save new password**.
5. Sign in with the new password.

The request page gives the same success message for registered and unknown
addresses. This does not confirm that an email was delivered. The system does
not allow a password change just by entering someone else's email.

## Required email setup

- Backend: set `PASSWORD_RESET_REDIRECT_URL` to
  `http://localhost:5173/reset-password` for local review, or the actual HTTPS
  frontend `/reset-password` URL for a deployed app. When unset, the first
  `CORS_ORIGIN` plus `/reset-password` is used.
- Supabase Auth URL Configuration: add that exact URL to the redirect allow
  list. Set Site URL to the correct frontend origin. Do not use a broad
  wildcard for production redirects.
- Supabase Auth email settings: configure a custom SMTP sender or an approved
  Send Email hook. The built-in hosted sender restricts recipients and is not
  suitable for ordinary users. Keep SMTP credentials out of this repository.
- Keep the standard recovery template using `{{ .ConfirmationURL }}` so
  Supabase verifies the email link before redirecting. This frontend handles
  the standard implicit callback with `type=recovery` and `access_token` in
  the URL fragment. A PKCE/code or custom token-hash template needs a
  corresponding callback implementation before use.
- Production hosting must serve the SPA for `/forgot-password` and
  `/reset-password` deep links, and the API's CORS origin must allow the
  frontend. Restart the backend after changing its environment.

Supabase settings inspected on October 27, 2026: Site URL was
`http://localhost:3000`, the redirect allow list was empty, and no custom SMTP
host or Send Email hook was configured. The release setup now sets Site URL to
`https://safe-water-dashboard.onrender.com` and allows the exact production
and localhost reset-page URLs. SMTP and Send Email hook settings remain
unchanged. Email delivery remains unverified.

## Behavior and security

Recovery routes are public; dashboard routes stay protected. Passwords must
have at least six characters and satisfy Supabase's password rules. Invalid
or expired links ask the user to request another link. Provider errors leave
the form available for retry. The API preserves provider rate limits.

The recovery access token stays in page memory and is removed from the URL.
The frontend does not save it in browser storage or accept a user ID to reset.
The backend validates that token and sends the password update to Supabase
Auth using the user's bearer token and anonymous API key. It does not use
the service-role key for password updates. The SDK's `updateUser` method
requires a stored SDK session, so this access-token-only endpoint uses the
equivalent Auth HTTP endpoint. No passwords or tokens are logged by this code.

After success, this browser tab clears its prior dashboard credentials and
asks the user to sign in. This does not claim that every session on every
other device has been revoked.

## Verification boundary

Automated route tests and browser checks use simulated Auth responses. They
do not send real email or change a real account password. After email setup,
use an explicitly approved disposable test account to verify delivery,
expiration, one-time email-link behavior, new-password login, old-password
rejection, and direct-link hosting in the deployed environment.

Official setup references:

- [Password recovery](https://supabase.com/docs/guides/auth/passwords)
- [Redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Implicit callback flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow)
