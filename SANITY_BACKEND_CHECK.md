# Sanity backend check — October 20, 2026

The configured Sanity backend was tested directly with the local server token.
Project: `8bms2xqg`. Dataset: `main`. API version: `2024-03-11`.
No token values, password hashes, addresses, emails, or other customer values are
included in this report. No orders, payments, or emails were created.

## Results

| Check | Result |
| --- | --- |
| Dataset reads using local server token | Passed |
| Published meal prices | 45 checked; zero invalid |
| Delivery fees, including legacy numeric text | 100 checked; zero invalid |
| Existing orders and transactions | 23 orders; 23 transactions |
| Orders with missing customer references | Zero |
| Transactions with missing order/customer references | Zero |
| Customer accounting field types | 20 checked; zero malformed |
| Missing customer transaction arrays | 20; the new finalizer initializes these with setIfMissing |
| Actual guest/order/transaction creation helper | Sanity dry-run passed |
| Revision-guarded customer accounting mutation | Sanity dry-run passed |
| Diagnostic documents persisted after dry runs | Zero |
| Orders created through checkout version 2 | Zero at the time of this check |

The guest-order test used the application's actual pending-order helper with real
catalogue references and synthetic customer details, forcing `dryRun: true` on its
commit. The accounting dry run tested the installed SDK's revision guard, missing
array defaults, reference appends, and numeric increments against an existing
customer document. Sanity validated the mutations without executing them. This is
not a completed end-to-end payment or proof of every historical record's correctness.

## Production deployment

GitHub reports production deployment `dpl_5pscPKgdoyUhxaJgySutpK5bq5pS` for company
commit `7c407a05c62e2a9e2d15a789d7cb255d795ef5d6` as successful. This commit includes
PR #5, which supports both token variable names. Its deployment ID matches the
failed request log supplied by the user.

[Open the matching Vercel deployment](https://vercel.com/euodiawholefoods-projects/euodiawholefoods/5pscPKgdoyUhxaJgySutpK5bq5pS).

The supplied production function log says:

```text
Checkout configuration incomplete {
  missing: [ 'SANITY_API_TOKEN or NEXT_SANITY_API_TOKEN' ],
  validBaseUrl: true
}
```

That check runs before any Sanity or Paystack request. The successful local tests
establish that the configured Sanity backend and local token accept the checkout
operations. They do not establish which environment values Vercel injected into
its production function. Vercel account settings and runtime logs are not connected
to this workspace; production credential values were not read or changed.

## Separate confirmed security finding

Anonymous queries can access customer and order records in this dataset. An
unauthenticated aggregate query could count all 20 customer records, all 23 orders,
and 8 customers with a visible password field. No password values were retrieved
or printed during this check. Sensitive records need protected data access; moving
to a private dataset requires replacing the storefront/admin browser queries with
appropriate server APIs so catalogue browsing continues to work. Dataset visibility
was not changed during this diagnostic check.

The previously documented statistics query failure and live payment/email validation
also remain separate work. This report does not certify the whole application for
production use.
