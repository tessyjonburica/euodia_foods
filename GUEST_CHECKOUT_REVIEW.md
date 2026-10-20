# Guest checkout review (before fixes)

Reviewed October 20, 2026. No application code, live customer records, payments, or
emails were changed. Checks used the actual route/helper modules with mocked
payment and database dependencies; this was not a live end-to-end payment test.

Implementation follow-up: the findings below describe the original behavior.
See [CHECKOUT_DEPLOYMENT.md](CHECKOUT_DEPLOYMENT.md) for the subsequent fixes,
deployment configuration, historical-data limits, and integration checks.

## Result

Buying without signing in is supported: the cart links directly to checkout,
checkout submits without an Authorization header when no token is present, and
the order route creates or finds a guest customer when there is no valid session.
A valid mocked guest request returned HTTP 200 with a payment authorization URL.
The implementation needs corrections before it can be considered reliable.

## Findings

1. **A saved order can still return HTTP 500.** The order route saves the order,
   saves its transaction, updates customer totals, and then links the transaction
   to the customer. Injecting a failure in the final link reproduced a 500 after
   both documents were saved. Retrying has no idempotency protection and can
   create another order. The catch block also runs failed-order accounting after
   successful accounting has already run.

2. **Guest emails cannot later register normally.** `createAnonymousUser` creates
   a customer without a password. Signup rejects any matching customer email;
   login rejects a missing password. Actual route tests reproduced registration
   HTTP 409 and login HTTP 401 for a guest record. Guest checkout should remain
   available, and later account activation should verify email ownership before
   attaching historical guest purchases or setting a password.

3. **Email alone can select an existing registered customer.** The guest lookup
   searches all customers by email and returns an existing registered record
   without authentication. A guest request can therefore attach purchases and
   accounting changes to someone else's account. Guest purchase records should
   remain separate from registered accounts until ownership is verified. Signed-in
   identity should also come from the verified token, rather than body `userId`.

4. **Payment initialization is treated as spending.** Both guest and registered
   customer helpers increase totalSpent before the customer completes payment.
   Failed payment initialization still invokes failed-order accounting. Totals
   should be finalized exactly once after verifying successful payment and its
   amount/currency. Paystack initialization provides a checkout URL; it is not
   confirmation that a charge succeeded.

5. **Server validation and purchased-item records are incomplete.** The submitted
   amount is passed to Paystack without recalculating product prices, quantities,
   and delivery fees on the server. The order helper reduces each purchased item
   to a product reference, discarding its quantity and purchase-time price. Missing
   email throws at `email.toLowerCase()` outside the error handler. Malformed
   requests should return validation errors before any writes or payment calls.

6. **Customer transaction arrays are not initialized before appending.** New guest
   records omit `transactions`; `updateTransaction` appends without setIfMissing.
   This should use an explicit array default, especially for older records. Its
   behavior against real missing/malformed fields was not tested remotely, so this
   is a code risk rather than a confirmed cause of the reported production error.

7. **The cart is cleared before payment completes.** Checkout clears the cart when
   initialization returns, prior to redirecting to Paystack. Cancelling payment
   loses the customer's cart. A successful response without an authorization URL
   also currently clears the cart without navigating anywhere.

## Clarification of an earlier review

The delivery fee is redundantly wrapped in the checkout and order route, but the
current createOrder helper unwraps the outer layer. A test through the actual
helper confirmed that the current checkout payload saves a reference with a string
_ref. The redundant wrapping alone is not evidence of the reported 500.

## Validation performed

- Valid guest request without authentication: mocked HTTP 200 and payment URL.
- Guest creation: no password or transactions array.
- Existing registered email: selected without authentication.
- Guest registration/login: HTTP 409/401 respectively.
- Missing email: uncaught exception reproduced before the route try block.
- Payment initialization failure: HTTP 500 and failed-accounting call.
- Transaction-link failure: HTTP 500 after saved order/transaction, with both
  successful and failed accounting calls.
- Submitted amount: forwarded directly to payment initialization.
- Actual order helper: delivery reference resolves correctly; quantities and
  purchase-time prices are not retained.

These checks do not establish which failure affected the reported customer.
Production logs for the failed request are still needed for that diagnosis.

## References

- [Paystack: accepting payments](https://paystack.com/docs/payments/accept-payments/)
- [Paystack: verifying payments](https://paystack.com/docs/payments/verify-payments/)
- [Sanity: creating and updating documents](https://www.sanity.io/docs/apis-and-sdks/js-client-mutations)
