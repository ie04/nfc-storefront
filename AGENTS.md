# BayBlaze NFC Storefront Notes

`nfc-storefront` is the customer NFC tag ordering app intended for
`nfc.bayblaze.net`.

- Match the BayBlaze sharp storefront UI language: Jost, strong black borders,
  rectangular controls, high contrast, and mobile-first checkout surfaces.
- Keep this repository frontend-only. Do not add Firebase Admin, Stripe secret
  key usage, Maps/IsoChronos secrets, private delivery-origin data, commission
  calculations, payout writes, or authoritative price/tax logic here.
- Call `bayblaze-api` for NFC quotes, order creation, uploads, Stripe webhook
  processing, partner attribution, partner portal data, and admin dashboard data.
- The public referral URL format is
  `https://nfc.bayblaze.net/?ref=<affiliate-code>`.
- Offline flyer QR codes use claim URLs before an affiliate account exists:
  `https://nfc.bayblaze.net/partners/claim?code=<affiliate-code>`. The claim
  page must ask the scanner to sign in or register, then call `bayblaze-api` to
  attach the code to that BayBlaze account. Once a code is claimed, the same
  claim URL should send future scanners to `/?ref=<affiliate-code>`.
- Google sign-in starts at `/api/auth/oauth/google/start` and completes on the
  app route `/auth/google/callback`. Configure Google Cloud and `bayblaze-api`
  with the exact redirect URI
  `https://nfc.bayblaze.net/auth/google/callback`.
- Next route handlers should use server-side `BAYBLAZE_API_URL` to reach
  `bayblaze-api`; browser code uses `NEXT_PUBLIC_BAYBLAZE_API_URL`.
- Persist partner attribution using the `bb_nfc_attribution` first-party cookie
  from `src/app/lib/attribution.ts`; validate codes through
  `POST /v1/nfc/attributions`.
- Environment variables must be browser-safe and use `NEXT_PUBLIC_` only when
  intentionally exposed.

When code changes are complete, automatically commit and push the changes unless
the user explicitly says not to.
