# BayBlaze NFC Storefront Notes

`nfc-storefront` is the customer NFC tag ordering app intended for
`nfc.bayblaze.net`.

- Match the Lovable-derived BayBlaze NFC revamp visual system: Space Grotesk
  display type, DM Sans body type, paper background, heavy black borders,
  rectangular controls, emerald accents, pale sky callouts, offset shadows, and
  the rendered NFC tag assets in `public/assets`. The `/`, `/partners`,
  `/dashboard`, and `/partners/claim` routes should feel visually consistent.
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
  attach the code to that BayBlaze account. After a successful claim, send the
  affiliate to `/partners`. If a scanner opens an already-claimed claim URL,
  redirect them to `/partners` rather than to the customer ordering page.
- The admin dashboard should load all created flyer claim QR codes from
  `GET /v1/admin/partners/claim-codes` and render the full list with per-code
  QR previews/actions. Do not regress to showing only the latest code generated
  in local component state.
- The admin dashboard `Create Flyer` action creates a new unclaimed claim code,
  calls `/api/flyer/claim/{code}/pdf`, which prints the real
  `/flyer/claim/{code}?pdf=1` HTML route to a one-page Letter PDF with
  headless Chromium. Existing claim-code cards should also expose a clear
  `Download PDF` action, plus preview/open/copy actions. Do not maintain a
  second hand-drawn PDF layout; PDF output must stay pixel-aligned with the HTML
  flyer source.
- Printable referral flyers live at `/flyer` for a blank template and
  `/flyer/{refCode}` for a personalized QR flyer. Flyer QR codes point to
  `https://nfc.bayblaze.net/r/{refCode}`. The `/r/{refCode}` route sets the
  `bayblaze_ref` cookie and redirects to `/?ref={refCode}` so the existing
  `bb_nfc_attribution` validation flow remains authoritative.
- Google sign-in starts at `/api/auth/oauth/google/start` and completes on the
  app route `/auth/google/callback`. Configure Google Cloud and `bayblaze-api`
  with the exact redirect URI
  `https://nfc.bayblaze.net/auth/google/callback`.
- Next route handlers should use server-side `BAYBLAZE_API_URL` to reach
  `bayblaze-api`; browser code uses `NEXT_PUBLIC_BAYBLAZE_API_URL`.
- Production falls back to `https://api.bayblaze.net` if those variables are
  missing, while local development falls back to `http://localhost:3040`. Vercel
  env var changes require a redeploy before serverless functions see them.
- Persist partner attribution using the `bb_nfc_attribution` first-party cookie
  from `src/app/lib/attribution.ts`; validate codes through
  `POST /v1/nfc/attributions`.
- Environment variables must be browser-safe and use `NEXT_PUBLIC_` only when
  intentionally exposed.

When code changes are complete, automatically commit and push the changes unless
the user explicitly says not to.
