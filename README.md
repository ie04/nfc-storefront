# BayBlaze NFC Storefront

Customer-facing NFC tag ordering interface for `nfc.bayblaze.net`.

`nfc-storefront` is intentionally a thin Next.js frontend. Authoritative pricing,
tax/fees, local-delivery eligibility, affiliate attribution, private uploads,
PaymentIntent creation, Stripe webhooks, commission ledger writes, and admin
authorization live in `bayblaze-api`.

The frontend visual system is based on the `ie04/bayblaze-nfc-revamp` design:
Space Grotesk headings, DM Sans body text, paper/ink/emerald/sky colors, hard
black borders, offset shadows, and rendered NFC tag product art.

## Local Development

```bash
npm install
npm run dev
```

Required public environment:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_BAYBLAZE_API_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

Required server environment:

- `BAYBLAZE_API_URL`

Do not commit Stripe secret keys, Firebase credentials, Maps keys, private
delivery-origin details, uploaded customer artwork, or production tokens.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
