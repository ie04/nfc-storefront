"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useMemo, useState } from "react";

import { clearAttributionCookie, readAttributionCookie, writeAttributionCookie } from "@/app/lib/attribution";
import type { FulfillmentMethod, NfcAddress, NfcCustomer, NfcDesign, ProductType, QuoteResponse } from "@/app/lib/contracts";
import { createOrder, quoteOrder, resolveAttribution, uploadDesignAsset } from "@/app/lib/api";
import { formatMoney } from "@/app/lib/format";
import { initialAddress, initialCustomer, initialDesign, productLabels, validateAddress, validateCustomer, validateDesign } from "@/app/lib/form-model";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export default function CheckoutFlow({ referralCode }: { referralCode?: string }) {
  const [design, setDesign] = useState<NfcDesign>(initialDesign);
  const [customer, setCustomer] = useState<NfcCustomer>(initialCustomer);
  const [address, setAddress] = useState<NfcAddress>(initialAddress);
  const [method, setMethod] = useState<FulfillmentMethod>("usps_standard");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [attributionToken, setAttributionToken] = useState(() => typeof document === "undefined" ? "" : readAttributionCookie());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const existingToken = readAttributionCookie();
    if (!referralCode) return;
    resolveAttribution({ code: referralCode, existingToken, sourcePath: "/" })
      .then((result) => {
        if (!alive) return;
        setAttributionToken(result.token);
        writeAttributionCookie(result.token);
        setMessage(`Referral ${result.code} is active for this order.`);
      })
      .catch((caught: Error) => {
        if (!alive) return;
        setError(caught.message);
      });
    return () => {
      alive = false;
    };
  }, [referralCode]);

  const formErrors = useMemo(() => ({
    ...validateDesign(design),
    ...validateCustomer(customer),
    ...validateAddress(address, method),
  }), [address, customer, design, method]);
  const canCreate = Object.keys(formErrors).length === 0 && !clientSecret;

  async function refreshQuote(nextMethod = method) {
    setError("");
    const nextQuote = await quoteOrder({ address, attributionToken, design, method: nextMethod });
    setQuote(nextQuote);
    if (nextMethod === "local_delivery" && nextQuote.fulfillmentEligibility.fulfillmentMethod !== "local_delivery") {
      setMethod("usps_standard");
      setMessage("That address is outside the local delivery area, so USPS standard shipping is selected.");
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Upload a PNG, JPEG, or WebP image.");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setBusy(true);
    try {
      const upload = await uploadDesignAsset(file);
      setDesign((current) => ({ ...current, uploadedAssetId: upload.uploadId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPreviewUrl("");
    } finally {
      setBusy(false);
    }
  }

  async function beginPayment() {
    setError("");
    setMessage("");
    const errors = Object.values(formErrors);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setBusy(true);
    try {
      const created = await createOrder({
        address,
        attributionToken,
        customer,
        design,
        idempotencyKey: crypto.randomUUID(),
        method,
      });
      setClientSecret(created.clientSecret);
      setOrderId(created.order.orderId);
      setQuote((current) => current ?? { ...created.order, attribution: { active: Boolean(attributionToken) }, currency: "usd", normalizedDestination: "", pricingPolicy: { commissionCents: 1_000, localDeliveryMaxMinutes: 30 } } as QuoteResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8">
      <main className="bb-panel p-4 sm:p-6" aria-labelledby="order-title">
        <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC</p>
        <h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl" id="order-title">Tap-ready tags, made local.</h1>
        <p className="mt-4 max-w-2xl text-base font-medium text-[var(--bb-muted)]">Configure a tag, choose delivery or USPS, and pay with embedded Stripe checkout.</p>

        {message ? <p className="mt-4 border-2 border-[var(--bb-line)] bg-[var(--bb-lime)] p-3 font-black">{message}</p> : null}
        {error ? <p className="mt-4 border-2 border-[var(--bb-red)] bg-white p-3 font-black text-[var(--bb-red)]">{error}</p> : null}

        <section className="mt-8 grid gap-6">
          <fieldset>
            <legend className="text-sm font-black uppercase tracking-wider">Tag Type</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {(Object.keys(productLabels) as ProductType[]).map((type) => (
                <button
                  className={`bb-button ${design.productType === type ? "bb-button-dark" : ""}`}
                  key={type}
                  onClick={() => setDesign((current) => ({ ...current, customColors: type === "custom" ? false : current.customColors, productType: type }))}
                  type="button"
                >
                  {productLabels[type]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 font-black">
            {design.productType === "plain" ? "Full website URL" : "Account handle or profile URL"}
            <input className="bb-input" onChange={(event) => setDesign({ ...design, programmedDestination: event.target.value })} value={design.programmedDestination} />
            {quote?.normalizedDestination ? <span className="text-sm font-bold text-[var(--bb-muted)]">Preview: {quote.normalizedDestination}</span> : null}
          </label>

          {design.productType !== "custom" ? (
            <div className="bb-card bg-[var(--bb-sky)] p-4">
              <label className="flex items-center gap-3 font-black">
                <input checked={design.customColors} onChange={(event) => setDesign({ ...design, customColors: event.target.checked })} type="checkbox" />
                Add custom colors for $5.00
              </label>
              {design.customColors ? (
                <textarea className="bb-input mt-3 min-h-24" onChange={(event) => setDesign({ ...design, colorDescription: event.target.value })} placeholder="Describe the colors you want." value={design.colorDescription || ""} />
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2 font-black">
                Custom design details
                <textarea className="bb-input min-h-32" onChange={(event) => setDesign({ ...design, customDesignDescription: event.target.value })} value={design.customDesignDescription || ""} />
              </label>
              <label className="grid gap-2 font-black">
                Optional logo or reference image
                <input accept="image/png,image/jpeg,image/webp" className="bb-input" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} type="file" />
              </label>
              {previewUrl ? (
                <div className="bb-card flex items-center gap-3 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Uploaded design reference preview" className="h-20 w-20 border-2 border-black object-cover" src={previewUrl} />
                  <button className="bb-button" onClick={() => { setPreviewUrl(""); setDesign({ ...design, uploadedAssetId: undefined }); }} type="button">Remove</button>
                </div>
              ) : null}
            </div>
          )}

          <label className="grid gap-2 font-black">
            Additional comments
            <textarea className="bb-input min-h-24" onChange={(event) => setDesign({ ...design, additionalComments: event.target.value })} value={design.additionalComments || ""} />
          </label>

          <section className="grid gap-3 sm:grid-cols-3" aria-label="Customer information">
            <input aria-label="Full name" className="bb-input" onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} placeholder="Full name" value={customer.fullName} />
            <input aria-label="Email" className="bb-input" onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="Email" value={customer.email} />
            <input aria-label="Phone" className="bb-input" onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="Phone" value={customer.phone} />
          </section>

          <fieldset>
            <legend className="text-sm font-black uppercase tracking-wider">Fulfillment</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button className={`bb-button ${method === "local_delivery" ? "bb-button-dark" : ""}`} onClick={() => setMethod("local_delivery")} type="button">Local delivery</button>
              <button className={`bb-button ${method === "usps_standard" ? "bb-button-dark" : ""}`} onClick={() => setMethod("usps_standard")} type="button">USPS standard</button>
            </div>
          </fieldset>

          <section className="grid gap-3 sm:grid-cols-2" aria-label="Delivery or shipping address">
            <input aria-label="Address line 1" className="bb-input sm:col-span-2" onChange={(event) => setAddress({ ...address, line1: event.target.value })} placeholder="Street address" value={address.line1} />
            <input aria-label="Address line 2" className="bb-input sm:col-span-2" onChange={(event) => setAddress({ ...address, line2: event.target.value })} placeholder="Apt, suite, optional" value={address.line2 || ""} />
            <input aria-label="City" className="bb-input" onChange={(event) => setAddress({ ...address, city: event.target.value })} placeholder="City" value={address.city} />
            <input aria-label="State" className="bb-input" onChange={(event) => setAddress({ ...address, state: event.target.value })} placeholder="State" value={address.state} />
            <input aria-label="ZIP code" className="bb-input" onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} placeholder="ZIP" value={address.postalCode} />
          </section>

          <div className="flex flex-wrap gap-3">
            <button className="bb-button" disabled={busy} onClick={() => void refreshQuote()} type="button">Update summary</button>
            <button className="bb-button bb-button-primary" disabled={busy || !canCreate} onClick={() => void beginPayment()} type="button">Start payment</button>
          </div>

          {clientSecret && stripePromise ? (
            <Elements options={{ clientSecret }} stripe={stripePromise}>
              <EmbeddedPayment orderId={orderId} onSuccess={() => { clearAttributionCookie(); setMessage("Payment received. BayBlaze will email your receipt and next steps."); }} />
            </Elements>
          ) : null}
        </section>
      </main>

      <aside className="bb-panel h-fit p-4 lg:sticky lg:top-6" aria-labelledby="summary-title">
        <h2 className="text-xl font-black" id="summary-title">Order Summary</h2>
        <SummaryRow label="Base price" value={quote?.money.basePriceCents} />
        {quote?.money.customColorSurchargeCents ? <SummaryRow label="Custom colors" value={quote.money.customColorSurchargeCents} /> : null}
        <SummaryRow label="Delivery or shipping" value={quote?.money.deliveryFeeCents} />
        <SummaryRow label="Estimated tax" value={quote?.money.estimatedTaxCents} />
        <div className="mt-4 border-t-2 border-black pt-4">
          <SummaryRow label="Total" strong value={quote?.money.totalCents} />
        </div>
        <p className="mt-4 text-sm font-bold text-[var(--bb-muted)]">
          {attributionToken ? "Referral attribution is active for this checkout." : "No referral attribution is active."}
        </p>
        {quote?.fulfillmentEligibility.status === "outside_local_delivery_area" ? (
          <p className="mt-3 border-2 border-black bg-[var(--bb-yellow)] p-3 font-black">Outside local delivery range. USPS is available.</p>
        ) : null}
      </aside>
    </div>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value?: number }) {
  return (
    <div className={`mt-3 flex items-center justify-between gap-4 ${strong ? "text-2xl font-black" : "font-bold"}`}>
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );
}

function EmbeddedPayment({ onSuccess, orderId }: { onSuccess: () => void; orderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    setBusy(false);
    if (result.error) {
      setError(result.error.message || "Payment could not be confirmed.");
      return;
    }
    onSuccess();
  }

  return (
    <section className="bb-card mt-6 p-4" aria-labelledby="payment-title">
      <h2 className="text-lg font-black" id="payment-title">Payment</h2>
      <p className="mb-4 text-sm font-bold text-[var(--bb-muted)]">Order {orderId}</p>
      <PaymentElement />
      {error ? <p className="mt-3 font-black text-[var(--bb-red)]">{error}</p> : null}
      <button className="bb-button bb-button-primary mt-4 w-full" disabled={busy || !stripe || !elements} onClick={() => void submit()} type="button">
        {busy ? "Confirming..." : "Pay securely"}
      </button>
    </section>
  );
}
