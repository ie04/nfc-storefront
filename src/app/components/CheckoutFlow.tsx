"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";

import { clearAttributionCookie, readAttributionCookie, writeAttributionCookie } from "@/app/lib/attribution";
import type { FulfillmentMethod, NfcAddress, NfcCustomer, NfcDesign, ProductType, QuoteResponse } from "@/app/lib/contracts";
import { createOrder, quoteOrder, resolveAttribution, uploadDesignAsset } from "@/app/lib/api";
import { formatMoney } from "@/app/lib/format";
import {
  buildProgrammedDestination,
  initialAddress,
  initialCustomer,
  initialDesign,
  productLabels,
  socialPlatformLabels,
  usesGuidedDestination,
  validateAddress,
  validateCustomer,
  validateDesign,
} from "@/app/lib/form-model";

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
  const submissionDesign = useMemo(() => prepareDesignForApi(design), [design]);

  async function refreshQuote(nextMethod = method) {
    setError("");
    const nextQuote = await quoteOrder({ address, attributionToken, design: submissionDesign, method: nextMethod });
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
        design: submissionDesign,
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
      <main className="grid gap-5" aria-labelledby="order-title">
        <section className="bb-panel overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 sm:p-8">
              <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black leading-none sm:text-6xl" id="order-title">Custom NFC tags that point people exactly where you want.</h1>
              <p className="mt-4 max-w-2xl text-lg font-semibold leading-7 text-[var(--bb-muted)]">
                Pick a tag style, tell us where it should send people, then choose how you want it delivered.
              </p>
            </div>
            <div className="border-t-2 border-black bg-[var(--bb-sky)] p-5 lg:border-l-2 lg:border-t-0">
              <h2 className="text-lg font-black uppercase">How it works</h2>
              <ol className="mt-4 grid gap-3">
                <ProcessStep number="1" title="Choose the tag" copy="Select a plain, social, or fully custom design." />
                <ProcessStep number="2" title="Set the destination" copy="Send taps to a website or social profile. We show a preview before payment." />
                <ProcessStep number="3" title="Review and pay" copy="Confirm delivery, check the total, and complete your order." />
              </ol>
            </div>
          </div>
        </section>

        {message ? <p className="mt-4 border-2 border-[var(--bb-line)] bg-[var(--bb-lime)] p-3 font-black">{message}</p> : null}
        {error ? <p className="mt-4 border-2 border-[var(--bb-red)] bg-white p-3 font-black text-[var(--bb-red)]">{error}</p> : null}

        <section className="bb-panel grid gap-6 p-4 sm:p-6" aria-labelledby="step-one-title">
          <StepHeading eyebrow="Step 1" title="Choose your tag style" />
          <fieldset>
            <legend className="sr-only" id="step-one-title">Choose your tag style</legend>
            <div className="grid gap-3 sm:grid-cols-5">
              {(Object.keys(productLabels) as ProductType[]).map((type) => (
                <button
                  className={`bb-button ${design.productType === type ? "bb-button-dark" : ""}`}
                  key={type}
                  onClick={() => setDesign((current) => ({
                    ...current,
                    customColors: type === "custom" ? false : current.customColors,
                    destinationKind: type === "instagram" || type === "snapchat" || type === "x" ? "social" : current.destinationKind || "website",
                    socialPlatform: type === "instagram" || type === "snapchat" || type === "x" ? type : current.socialPlatform || "instagram",
                    productType: type,
                  }))}
                  type="button"
                >
                  {productLabels[type]}
                </button>
              ))}
            </div>
          </fieldset>

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
        </section>

        <section className="bb-panel grid gap-6 p-4 sm:p-6" aria-labelledby="step-two-title">
          <StepHeading eyebrow="Step 2" title="Tell us where the tag should go" />
          <DestinationFields design={design} quote={quote} setDesign={setDesign} />

          <label className="grid gap-2 font-black">
            Anything else we should know?
            <textarea className="bb-input min-h-24" onChange={(event) => setDesign({ ...design, additionalComments: event.target.value })} value={design.additionalComments || ""} />
          </label>
        </section>

        <section className="bb-panel grid gap-6 p-4 sm:p-6" aria-labelledby="step-three-title">
          <StepHeading eyebrow="Step 3" title="Contact and delivery" />
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
            <button className="bb-button" disabled={busy} onClick={() => void refreshQuote()} type="button">Review total</button>
            <button className="bb-button bb-button-primary" disabled={busy || !canCreate} onClick={() => void beginPayment()} type="button">Continue to payment</button>
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

function ProcessStep({ copy, number, title }: { copy: string; number: string; title: string }) {
  return (
    <li className="flex gap-3 border-2 border-black bg-white p-3">
      <span className="grid size-9 shrink-0 place-items-center bg-black text-sm font-black text-white">{number}</span>
      <span>
        <span className="block font-black">{title}</span>
        <span className="block text-sm font-bold text-[var(--bb-muted)]">{copy}</span>
      </span>
    </li>
  );
}

function StepHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h2>
    </div>
  );
}

function DestinationFields({
  design,
  quote,
  setDesign,
}: {
  design: NfcDesign;
  quote: QuoteResponse | null;
  setDesign: Dispatch<SetStateAction<NfcDesign>>;
}) {
  const guided = usesGuidedDestination(design);
  const social = design.destinationKind === "social";
  const fixedSocial = design.productType === "instagram" || design.productType === "snapchat" || design.productType === "x";
  const destinationValue = design.destinationInput ?? design.programmedDestination;

  if (!guided) {
    return (
      <label className="grid gap-2 font-black">
        {productLabels[design.productType]} handle or profile URL
        <input
          className="bb-input"
          onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
          placeholder={`@${design.productType === "x" ? "yourname" : "yourhandle"}`}
          value={destinationValue || ""}
        />
        {quote?.normalizedDestination ? <span className="text-sm font-bold text-[var(--bb-muted)]">Preview: {quote.normalizedDestination}</span> : null}
      </label>
    );
  }

  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className="text-sm font-black uppercase tracking-wider">What should this tag open?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CheckboxChoice
            checked={design.destinationKind === "website"}
            label="A website"
            onChoose={() => setDesign({ ...design, destinationKind: "website" })}
          />
          <CheckboxChoice
            checked={social}
            label="A social media profile"
            onChoose={() => setDesign({ ...design, destinationKind: "social", socialPlatform: design.socialPlatform || "instagram" })}
          />
        </div>
      </fieldset>

      {social ? (
        <div className="grid gap-3">
          <label className="grid gap-2 font-black">
            Social media site
            <select
              className="bb-input"
              disabled={fixedSocial}
              onChange={(event) => setDesign({ ...design, socialPlatform: event.target.value })}
              value={fixedSocial ? design.productType : design.socialPlatform || "instagram"}
            >
              {Object.entries(socialPlatformLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {(design.socialPlatform === "other" && !fixedSocial) ? (
            <label className="grid gap-2 font-black">
              Which site?
              <input
                className="bb-input"
                onChange={(event) => setDesign({ ...design, socialOtherSite: event.target.value })}
                placeholder="threads.net, pinterest.com, your community page..."
                value={design.socialOtherSite || ""}
              />
            </label>
          ) : null}
          <label className="grid gap-2 font-black">
            Handle or profile name
            <input
              className="bb-input"
              onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
              placeholder="@yourhandle"
              value={destinationValue || ""}
            />
          </label>
        </div>
      ) : (
        <label className="grid gap-2 font-black">
          Website address
          <input
            className="bb-input"
            onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
            placeholder="https://yourwebsite.com"
            value={destinationValue || ""}
          />
          <span className="text-sm font-bold text-[var(--bb-muted)]">Please double-check spelling before checkout. We program the tag exactly to the address you provide.</span>
        </label>
      )}

      {quote?.normalizedDestination ? <p className="border-2 border-black bg-[var(--bb-lime)] p-3 text-sm font-black">Preview: {quote.normalizedDestination}</p> : null}
    </div>
  );
}

function CheckboxChoice({ checked, label, onChoose }: { checked: boolean; label: string; onChoose: () => void }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 border-2 border-black p-3 font-black ${checked ? "bg-black text-white" : "bg-white"}`}>
      <input checked={checked} onChange={onChoose} type="checkbox" />
      {label}
    </label>
  );
}

function prepareDesignForApi(design: NfcDesign): NfcDesign {
  return {
    additionalComments: design.additionalComments,
    colorDescription: design.colorDescription,
    customColors: design.productType === "custom" ? false : design.customColors,
    customDesignDescription: design.customDesignDescription,
    programmedDestination: buildProgrammedDestination(design),
    productType: design.productType,
    uploadedAssetId: design.uploadedAssetId,
  };
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
