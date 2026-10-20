# Initial project review

## Scope

Inspected source, dependency configuration, authentication, orders, payment verification,
storefront, and admin data access. No real orders, emails, or remote mutations were
performed. This is an initial review, not a complete security audit.

## Changes made

- Restored `npm run lint`, previously a successful echo with no checks.
- Removed invalid `git adimport` syntax from the unused App Router `_app.js`.
- Added setup documentation and `.env.example`.
- Made Sanity project/dataset configurable and replaced the public token with server-only `SANITY_API_TOKEN`.
- Required an existing admin token for admin signup.
- Removed JWT logging from the session helper.
- Removed duplicate writes in the payment helper, including failed payments writing `success`. The API route owns status persistence.
- Matched displayed VAT with checkout's existing 7.5% calculation; business/tax correctness was not evaluated.
- Prevented menu filtering crashes on missing category, description, or price.
- Prevented the Axios error interceptor from crashing on network errors.
- Fixed the customer password-reset query's email parameter name.
- Made the payment result page show success only after successful verification and moved browser URL access into an effect.
- Removed unused Google Font declarations that were blocking builds on font downloads; neither declaration was applied to a layout class.

## Remaining issues, by priority

### Critical: sensitive Sanity access from the browser

`utils/sanity/client.js` was imported into client components with a public write token.
The token is now server-only, but direct browser mutations remain in
`app/admin/orders/[id]/page.jsx`, `components/reusables/category/adminpage.jsx`,
`components/reusables/category/PopularMeals.jsx`, and `components/pages/admin/BestSellers.jsx`.
Move these to authenticated API routes. Admin pages also fetch customers, orders, and
transactions directly. UI token checks do not authorize Sanity queries. Use a private
dataset for sensitive records and expose selected menu fields through server APIs.
If a public write token was deployed, rotate it and review access history.

### Critical: checkout trusts client data

`app/api/order/route.js` trusts the submitted amount and signed-in `userId`. Fetch prices
and delivery fees on the server, validate quantities, calculate totals, and derive identity
from `session.user.userId`. `createOrder` in `utils/sanity/client.js` reduces cart items
to product references, losing quantities and purchase-time prices. Guest checkout can
associate orders with an existing email without proof of ownership.

### High: account APIs expose sensitive records

`app/api/user/route.js` finds customers by caller-supplied email and returns the full
record. Its helper spreads untrusted `customerDetails` into new documents. Admin login/signup
routes return documents containing password hashes. Customer login/signup responses
have since been restricted to identity fields. Use explicit response
fields, validate inputs, and authorize access to private data.

### High: incomplete payment/order state

Order counts and spending update before payment confirmation. Verification does not
compare paid amount/currency to the order and only updates the transaction, not order
completion. There is no webhook handler or idempotent finalization. Verification network
errors become `false` and may mark transactions failed. Checkout clears the cart before
payment completes. The delivery fee reference is wrapped in checkout and wrapped again
in the order API. The guest-checkout follow-up confirmed that `createOrder` unwraps
the outer reference, so the current checkout payload reaches storage as a valid reference.

### High: admin statistics endpoint lacks authorization

`app/api/admin/statistics/route.js` has no admin check. The production build confirmed
Sanity rejects its query with `Undefined function "sum"`; the handler catches this
and returns 500. Queries also contain inconsistent field names and a `group()` pipeline
requiring correction. Next attempted this GET handler during page generation;
declare dynamic execution explicitly alongside authorization and corrected queries.

### Other defects and maintenance

- Incomplete input validation turns malformed login/reset/order payloads into 500s.
- Meal deletion uses a questionable unset path and can affect historical order references; prefer archiving purchased products.
- The inactive Axios initializer was removed during repository cleanup.
- Checkout registers `fullName` but checks conditions/errors for `firstName`.
- Manifest follow-up: moved the manifest to `public/site.webmanifest`, corrected its
  icon URLs and layout icon paths, and removed the reference to an absent Safari icon.
  Manifest and all five referenced PNG icon URLs returned HTTP 200 locally.
- The unused Stripe helper was removed during repository cleanup; checkout uses Paystack.
- Runtime follow-up: replaced CI's Node 18 with Node 24 and `npm install` with `npm ci`.
  Added `engines.node: "24.x"` and `.nvmrc` to align deployment and local runtime selection.
  Hosted Vercel settings/deployment still need this change deployed.
- No automated test suite or Sanity schema/migration source is included.

## Validation

Results are appended after execution. Credentials are absent, so authenticated admin,
email, and end-to-end payment behavior cannot be verified in this checkout.

- `npm ci --no-fund --no-audit`: passed; installed 546 packages.
- `npm run lint`: passed, no warnings or errors.
- `npm audit --omit=dev --json`: reported 25 affected packages (2 critical, 18 high,
  5 moderate). The generated JSON report was removed during cleanup; rerun
  `npm audit --omit=dev --json` for a fresh report. The installed Next.js version
  is 14.2.11. Several suggested fixes require major version changes; dependency
  upgrades need a separate compatibility pass before deployment.
- Created ignored `.env.local` with localhost URLs and a randomly generated local
  JWT secret. Sanity, Paystack, and email credentials remain blank.
- The first build attempt stalled on Google Fonts downloads and was stopped.
  The unused font declarations were removed before retrying.
- `npm run build`: passed after removing unused font downloads. It also logged the
  confirmed statistics query error above; build success does not validate that endpoint.
- `npm run lint` was repeated after the final code changes and passed.
- `git diff --check`: passed.
- Production server started at http://127.0.0.1:3000 with `npm run start -- --hostname 127.0.0.1`.
- HTTP smoke checks: `/`, `/menu`, `/cart`, `/checkout`, `/login`, and `/success` returned 200.
- `/api/dishes` returned 200 with 45 dishes; no customer records were retrieved for smoke testing.
- Unauthenticated `POST /api/admin/signup` returned 403 before any database access.
- Browser automation reported no available browsers. Visual rendering, hydration,
  interactive cart behavior, and Sanity browser CORS were not verified.

## Registration and manifest follow-up

- Confirmed Sanity connectivity and required environment variable presence without
  logging credentials. The customer email supplied by the user had no matching record
  in the configured dataset.
- Found false-success registration: `createUser` returned an error object after a
  failed write, and signup issued a token/success response without a saved customer ID.
- Database lookup/write failures now propagate; signup requires a saved ID, checks
  required inputs and JWT configuration, and reports save failures. Registration UI
  also requires a saved user ID and token before redirecting.
- Customer login trims email, validates inputs, and rejects missing passwords as 401.
  Customer login/signup responses no longer include password hashes.
- Mocked checks against the actual route modules passed for write failures, error
  objects, successful saves, duplicates, missing JWT configuration, missing accounts,
  missing passwords, wrong passwords, successful login, and password redaction.
- Targeted lint passed. Live signup/login invalid-input checks returned 400; missing
  customer login returned 401. No accounts were created or modified during verification.
- Switched the local server from `npm start` to `npm run dev -- --hostname 127.0.0.1`
  so source edits reload and the current `.env.local` is loaded. The user must retry
  registration; successful remote creation and login have not yet been verified.

## Customer login navigation follow-up

- Login previously re-enabled submission and displayed success before `router.push('/')`
  completed. The user reported needing a second submission to leave the login page.
- Customer login now validates the response, writes and verifies both session cookies,
  then calls `window.location.replace('/')` to load the home page with fresh session state.
  Submission remains locked until navigation; failed authentication or cookie writes
  restore the form. A ref also blocks duplicate submissions before React rerenders.
- Checks against the compiled login component passed for one request during duplicate
  submissions, cookie writes before redirect, retained loading state, blocked cookies,
  incomplete API responses, and retry after authentication failure. These used mocks;
  a real authenticated browser login remains to be confirmed by the user.

## Verification rerun — October 19, 2026

- Built the current source using Node 24.14.0: compilation, lint/type validation,
  and generation of 44 pages completed; `npm run build` exited successfully.
- The statistics route again logged Sanity's `Undefined function "sum"` error.
  This remains a known functional failure despite the successful build.
- Started the fresh production build with `npm run start -- --hostname 127.0.0.1`;
  left it running at http://localhost:3000. Source edits require a rebuild/restart
  in this mode; use `npm run dev` instead when editing.
- HTTP 200 for `/`, `/menu`, `/cart`, `/checkout`, `/login`, `/register`,
  `/contact-us`, `/order`, `/success`, `/forgot-password`, `/reset-password`, and `/auth/login`.
- All 21 JS/CSS assets referenced by the login page returned 200. The manifest
  and its icon resources returned 200. Dishes returned 45 items; categories returned 200.
- Live validation checks: empty login/signup returned 400; unauthenticated admin
  signup returned 403; a nonexistent customer login returned 401, all as expected.
- Seven mocked auth checks passed against the current route modules, including
  failed/successful login, failed/successful signup saves, and password redaction.
- Required credential variables are populated; their values were not logged.
  No accounts were created or changed, and no payment or email actions were executed.
- Browser inventory remains empty. Actual login redirects, hydrated UI behavior,
  payment completion, email delivery, and admin workflows are not fully verified.

## Repository cleanup — October 19, 2026

- Removed 31 unused tracked files (about 1.1 MB): the old Pages Router `_app.js`,
  unreachable dashboard components/hooks/helpers, unused Stripe and multer helpers,
  an unused base64 logo module, a duplicate logo, placeholder ad configuration,
  and seven unreferenced public assets. Public pages/API routes and used media remain.
- Removed unused `flowbite-react`, `next-connect`, `react-hot-toast`, and `lint-staged`.
  The lockfile contains 513 entries instead of 575. Existing package versions were
  preserved except the transitive picomatch patch required by the resolved tree.
  Retained the active Flowbite form styling plugin.
- Removed stale Husky package configuration, inactive lint-staged configuration,
  the invalid ANALYZE script, and obsolete Tailwind source globs.
- Removed an unused homepage Sanity request, inactive HomeLayout metadata, unused
  imports, and old commented implementations. Global CSS/toast styling is imported
  in the root layout; eleven duplicate toast containers were removed.
- Removed the generated dependency audit JSON and added it to `.gitignore`.
  `.env.local`, its credentials, the active Git hook, and current project docs remain.
- Source parsing/import verification found no broken local imports. Further install,
  build, and HTTP validation results are recorded after execution.
- Removed seven unreferenced helper exports from the remaining service modules.
- Clean installation passed with `npm ci --ignore-scripts --no-audit --no-fund`:
  484 packages installed, compared with 546 before cleanup.
- All 111 remaining JavaScript/JSX files parse and are reachable from app entry points;
  no broken local imports were found. `git diff --check` passed.
- Automatic approval review blocked optional removal of empty folders with
  “blocked by policy.” Those untracked folders were left in place.
- Cleanup validation completed: production build (including lint/type validation)
  passed and generated the same 44 pages. The known statistics query error remains.
- Restarted the cleaned production build at http://localhost:3000. All 12 checked
  public pages, 19 login JS/CSS assets, manifest/icons, logo/meal media, dishes
  (45 items), and category API checks passed. Auth validation returned expected
  400/401/403 responses. No live account, payment, or email mutations were performed.

## Guest checkout follow-up — October 20, 2026

The active checkout implementation now uses server catalogue prices, validated
quantities/delivery details, and verified session identity. Guest purchases create
separate customer records rather than selecting registered accounts by email.
Pending guest/order/transaction creation is atomic; retries retain one order and
payment reference. New purchases retain quantity and price snapshots.

Payment verification now checks amount, currency, reference, and successful status.
A revision-guarded transaction updates payment state and customer accounting once,
shared by the return page and signed Paystack webhook. Cart clearing occurs only
after successful verification. Legacy spending figures are not automatically repaired.

Guest signup directs the customer to the emailed Set or reset password flow.
Recovery prefers a registered account over guest records; token hashes, expiry,
and revision guards protect account activation. Old password links must be requested
again. No guest records or historical orders are merged automatically.

The earlier checkout findings describe the previous implementation. See
[CHECKOUT_DEPLOYMENT.md](CHECKOUT_DEPLOYMENT.md) for configuration and limits.
Fourteen isolated regression tests passed, along with lint. No live payments,
emails, or remote customer mutations were performed. Live integration and visual
browser checks still require the configured preview/test environment.