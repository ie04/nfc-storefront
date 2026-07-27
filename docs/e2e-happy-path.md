# NFC Happy Path Verification

Automated browser execution requires Stripe test keys, webhook forwarding, and
test BayBlaze accounts. Use this checklist after those credentials are present:

1. Visit `/?ref=<active-affiliate-code>`.
2. Configure an Instagram tag with custom colors.
3. Enter a locally eligible address.
4. Confirm the embedded Stripe Payment Element with a Stripe test payment
   method.
5. Forward `payment_intent.succeeded` to
   `POST /v1/nfc/stripe/webhook`.
6. Confirm the order becomes `fulfillment_pending`.
7. Confirm exactly one 1000-cent NFC commission exists for the affiliate.
8. Sign in at `/partners` and verify the ledger entry.
9. Sign in as admin at `/dashboard` and verify the sale and commission.
10. Repeat with a custom design and uploaded logo; verify the 500-cent custom
    color surcharge is absent.
