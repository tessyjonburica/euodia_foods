# Admin password reset

The public admin recovery page is `/auth/forgot-password`. Emailed links open
`/auth/reset-password`, and successful password changes return to `/auth/login`.
Customer recovery remains separate at `/forgot-password`.

## Required production configuration

- `SANITY_API_TOKEN` or `NEXT_SANITY_API_TOKEN`: a server-only Sanity token with
  write permission for admin documents in the configured project/dataset.
- `NEXT_PRIVATE_EMAIL`: the Gmail sender account.
- `NEXT_PRIVATE_PASS`: the working Gmail SMTP app password for that account.
- `NEXT_PUBLIC_BASE_URL`: the site's HTTP(S) origin, normally
  `https://www.euodiawholefoods.com` for this deployment.

Apply these to the correct Vercel project's Production environment and create a
new deployment after changes. Neither the local environment nor a successful build
establishes which credentials are available in a production function.

## Diagnosing failures

The API now returns a support reference and logs only the operation stage, status,
and recognized SMTP error code. Raw SDK/SMTP errors, token values, email addresses,
and passwords are not logged by these admin reset handlers.

| Reference | Meaning |
| --- | --- |
| `ADMIN_RESET_CONFIGURATION` | Required variable missing or base URL invalid; server log lists variable names only |
| `ADMIN_RESET_STORAGE_PERMISSIONS` | Sanity rejected the account lookup or token save with 401/403 |
| `ADMIN_RESET_STORAGE_UNAVAILABLE` | Other Sanity lookup or token-save failure |
| `ADMIN_RESET_EMAIL_AUTH` | SMTP authentication failed; verify the production email account/app password |
| `ADMIN_RESET_EMAIL_UNAVAILABLE` | Other SMTP connection or message-delivery failure |
| `ADMIN_PASSWORD_SAVE_UNAVAILABLE` | Password update failed after token validation |

The browser displays the reset-request reference, so the next failure can be
identified without relying on a generic Internal server error message.

## Token behavior

New admin links use random tokens stored only as SHA-256 hashes in Sanity. Links
expire after one hour and are consumed with a revision guard, including concurrent
submissions. The route accepts only the new token format; request a fresh email
after deployment instead of using older UUID links. Successful changes preserve
the existing behavior of setting `isVerified` to true.

Unknown admin emails receive the same generic success response as known emails.
This does not guarantee an email was delivered. The SMTP helper has bounded
connection and socket timeouts, and logging remains disabled.

## Checks performed

- Direct Sanity reset-token write validation passed for all four existing admin
  documents using dry-run requests. No admin documents were changed.
- Local Gmail SMTP connection and authentication verification passed. No email
  was sent; this does not establish inbox delivery or Vercel's SMTP connectivity.
- Production `/auth/forgot-password`, `/auth/reset-password`, and `/auth/login`
  returned HTTP 200. A reset request for a random nonexistent diagnostic email
  reached the admin lookup and returned the old handler's expected 404.
- All 24 isolated regression tests passed, including normalized email, hashed
  tokens, expiry, concurrent single-use protection, missing configuration before
  writes, storage/email failure distinctions, and safe logging.

These checks do not identify the original production exception: the old handler
returned the same Internal server error for storage and email failures. Production
credentials and successful delivery still need to be confirmed after deployment.
