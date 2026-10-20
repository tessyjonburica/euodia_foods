# Euodia Foods

Next.js App Router storefront and admin dashboard using React, Redux Persist,
Sanity, Paystack, and Gmail SMTP. Sanity Studio/schema source is not included.

## Local setup

1. Install Node.js 24.x and npm. This checkout was inspected with Node 24.14.0 and npm 11.9.0.
2. Run `npm ci` to install locked dependencies.
3. Copy `.env.example` to `.env.local` and fill in server credentials.
   Generate a JWT secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Run `npm run dev` and open http://localhost:3000.
5. Run `npm run lint` and `npm run build` before deploying. `npm start` serves a production build.

The storefront can start without payment/email credentials; those features require
configuration. Content requires access to Sanity. Allow http://localhost:3000 in the
Sanity project's CORS settings for browser reads. Use a development dataset and
Paystack test credentials for integration work.

## Environment

See `.env.example`. `NEXT_PUBLIC_*` values are browser-visible.
`SANITY_API_TOKEN` must stay server-only. Remove and rotate any previously deployed
`NEXT_PUBLIC_SANITY_TOKEN`. Existing browser admin mutations need authenticated server
routes and will not work with a server-only token. Review Sanity dataset visibility:
customer passwords, reset tokens, addresses, and orders must not be publicly readable.

Email uses Gmail SMTP. `NEXT_PRIVATE_PASS` should be an app password for the mailbox
in `NEXT_PRIVATE_EMAIL`. `NEXT_PUBLIC_BASE_URL` controls password-reset links.
Provision the first admin through a trusted Sanity/server workflow;
`/api/admin/signup` now requires an existing admin token.

See [PROJECT_REVIEW.md](PROJECT_REVIEW.md) for remaining defects and validation results.
See [CHECKOUT_DEPLOYMENT.md](CHECKOUT_DEPLOYMENT.md) for guest checkout, payment
webhook configuration, and account activation. Run `npm run test:checkout` before
deploying checkout changes.

## Deployment runtime

`package.json` selects Node.js `24.x` for Vercel; CI and `.nvmrc` use Node 24 too.
Deploy this change for the runtime selection to take effect. If configuring Vercel
manually, choose **Project Settings > Build and Deployment > Node.js Version > 24.x**.
The hosted project settings and deployment have not been changed from this workspace.

## Repository layout

- `app/`: pages, layouts, and API routes (Next.js App Router).
- `components/`, `layout/`: shared storefront and admin UI.
- `hooks/`, `store/`, `utils/`: client state and service helpers.
- `public/`: referenced site media, icons, manifest, and SEO files.

Global CSS and the toast container are defined once in `app/layout.js`.
The active Git hook is `.husky/pre-commit`; it runs lint before a commit.
Generate dependency reports when needed with `npm audit --omit=dev --json`;
the generated `dependency-audit.json` file is ignored.
