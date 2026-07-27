/* eslint-disable @next/next/no-img-element */
"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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

const productBlurbs: Record<ProductType, string> = {
  custom: "Send artwork, we print it on the face.",
  instagram: "Printed camera mark for profile taps.",
  plain: "Blank matte disc. Goes anywhere, says nothing.",
  snapchat: "Ghost mark, tuned for the snapcode crowd.",
  x: "Single-letter mark, high contrast.",
};

const productDisplayPrices: Record<ProductType, string> = {
  custom: "$40.00",
  instagram: "$20.00",
  plain: "$20.00",
  snapchat: "$20.00",
  x: "$20.00",
};

const previewImages: Record<ProductType, { alt: string; src: string }> = {
  custom: {
    alt: "3D printed green NFC keychain tag with a custom star design",
    src: "/assets/tag-custom.png",
  },
  instagram: {
    alt: "3D printed NFC keychain tag with a camera icon",
    src: "/assets/tag-instagram.png",
  },
  plain: {
    alt: "3D printed blank NFC keychain tag",
    src: "/assets/tag-plain.png",
  },
  snapchat: {
    alt: "3D printed NFC keychain tag with a ghost icon",
    src: "/assets/tag-snapchat.png",
  },
  x: {
    alt: "3D printed black NFC keychain tag with a white X",
    src: "/assets/tag-x.png",
  },
};

const productOrder: ProductType[] = ["plain", "instagram", "snapchat", "x", "custom"];

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
  const [uploadName, setUploadName] = useState("");
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
    setUploadName(file.name);
    setBusy(true);
    try {
      const upload = await uploadDesignAsset(file);
      setDesign((current) => ({ ...current, uploadedAssetId: upload.uploadId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
      setPreviewUrl("");
      setUploadName("");
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
      setQuote((current) => current ?? {
        ...created.order,
        attribution: { active: Boolean(attributionToken) },
        currency: "usd",
        normalizedDestination: "",
        pricingPolicy: { commissionCents: 1_000, localDeliveryMaxMinutes: 30 },
      } as QuoteResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start payment.");
    } finally {
      setBusy(false);
    }
  }

  function selectProduct(type: ProductType) {
    setDesign((current) => ({
      ...current,
      customColors: type === "custom" ? false : current.customColors,
      destinationKind: type === "instagram" || type === "snapchat" || type === "x" ? "social" : current.destinationKind || "website",
      productType: type,
      socialPlatform: type === "instagram" || type === "snapchat" || type === "x" ? type : current.socialPlatform || "instagram",
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="font-display text-sm font-bold tracking-[0.18em] uppercase">
            BayBlaze<span className="text-emerald"> NFC</span>
          </span>
          <span className="text-xs text-muted-foreground">Programmed by hand · Tampa Bay · Ships nationwide</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:py-14" aria-labelledby="order-title">
        <Hero />

        {message ? <p className="panel offset-sm bg-sky p-4 font-display text-sm font-bold">{message}</p> : null}
        {error ? <p className="panel offset-sm border-destructive bg-card p-4 font-display text-sm font-bold text-destructive">{error}</p> : null}

        <section className="panel offset p-8 sm:p-10" aria-labelledby="step-one-title">
          <SectionHeading
            hint="Every tag is the same 30mm disc. The face is what changes."
            step="Step 1"
            title="Choose your tag style"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {productOrder.map((type) => {
              const active = design.productType === type;
              return (
                <button
                  aria-pressed={active}
                  className={`flex items-start gap-4 border-2 border-ink p-4 text-left transition-transform ${
                    active ? "offset-sm -translate-x-[2px] -translate-y-[2px] bg-sky" : "bg-card hover:-translate-y-[2px]"
                  }`}
                  key={type}
                  onClick={() => selectProduct(type)}
                  type="button"
                >
                  <TagPreview customColors={active && type !== "custom" && design.customColors} style={type} />
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-base font-bold">{productLabels[type]}</span>
                      <span className="font-display text-sm font-bold">{productDisplayPrices[type]}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{productBlurbs[type]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {design.productType === "custom" ? (
            <CustomDesignPanel
              busy={busy}
              design={design}
              onFile={onFile}
              previewUrl={previewUrl}
              setDesign={setDesign}
              setPreviewUrl={setPreviewUrl}
              setUploadName={setUploadName}
              uploadName={uploadName}
            />
          ) : (
            <GenericColorPanel design={design} setDesign={setDesign} />
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-6">
            <section className="panel offset p-8 sm:p-10" aria-labelledby="step-two-title">
              <SectionHeading
                hint="We program the tag exactly as written. Double-check the spelling."
                step="Step 2"
                title="Tell us where the tag should go"
              />
              <DestinationFields design={design} quote={quote} setDesign={setDesign} />
              <label className="mt-5 grid gap-2">
                <span className="eyebrow">Anything else we should know?</span>
                <textarea
                  className="bb-input min-h-24 resize-y placeholder:text-muted-foreground"
                  onChange={(event) => setDesign({ ...design, additionalComments: event.target.value })}
                  placeholder="Artwork notes, deadlines, quantity questions..."
                  rows={3}
                  value={design.additionalComments || ""}
                />
              </label>
            </section>

            <section className="panel offset p-8 sm:p-10" aria-labelledby="step-three-title">
              <SectionHeading
                hint="We only use this to confirm the order and hand off the tag."
                step="Step 3"
                title="Contact and delivery"
              />
              <ContactFields address={address} customer={customer} setAddress={setAddress} setCustomer={setCustomer} />
              <FulfillmentChoice method={method} setMethod={setMethod} />
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="bb-button offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={busy} onClick={() => void refreshQuote()} type="button">
                  Review total
                </button>
                <button className="bb-button bb-button-primary offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={busy || !canCreate} onClick={() => void beginPayment()} type="button">
                  Continue to payment
                </button>
              </div>

              {clientSecret && stripePromise ? (
                <Elements options={{ clientSecret }} stripe={stripePromise}>
                  <EmbeddedPayment orderId={orderId} onSuccess={() => { clearAttributionCookie(); setMessage("Payment received. BayBlaze will email your receipt and next steps."); }} />
                </Elements>
              ) : null}
            </section>
          </div>

          <OrderSummary attributionToken={attributionToken} method={method} quote={quote} />
        </div>
      </main>

      <footer className="border-t-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} BayBlaze NFC</span>
          <span>Questions? hello@bayblaze.net</span>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  const steps = [
    ["Choose the tag", "Plain, social, or a fully custom printed face."],
    ["Set the destination", "A website or a social profile. Preview before you pay."],
    ["Review and pay", "Confirm delivery, check the total, done."],
  ];

  return (
    <section className="space-y-6">
      <div className="panel offset overflow-hidden">
        <div className="grid items-center gap-10 p-8 sm:p-14 lg:grid-cols-[1.35fr_auto] lg:gap-16">
          <div>
            <span className="eyebrow text-emerald">BayBlaze NFC</span>
            <h1 className="mt-6 max-w-4xl text-5xl leading-[0.92] sm:text-6xl lg:text-8xl" id="order-title">
              Custom NFC tags that point people exactly where you want.
            </h1>
            <p className="mt-8 max-w-xl text-lg text-muted-foreground">
              Pick a tag style, tell us where it should send people, then choose how you want it delivered. No app, no account - one tap and they land on you.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <TagPreview size="lg" style="custom" />
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t-2 border-ink lg:grid-cols-4">
          {[
            ["Reprogrammable", "Change the link anytime"],
            ["Waterproof", "IP68 epoxy shell"],
            ["From $20", "Per tag before tax"],
            ["Tampa Bay", "Local drop-off available"],
          ].map(([label, value], index) => (
            <div
              className={`p-6 ${index % 2 === 1 ? "border-l-2 border-ink" : ""} ${index > 1 ? "border-t-2 border-ink lg:border-t-0" : ""} ${index === 2 ? "lg:border-l-2" : ""}`}
              key={label}
            >
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr] lg:items-stretch">
        <div className="panel offset bg-sky p-8">
          <h2 className="eyebrow">How it works</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map(([title, body], index) => (
              <li className="border-2 border-ink bg-card p-5" key={title}>
                <span className="grid h-8 w-8 place-items-center border-2 border-ink bg-ink font-display text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="mt-4 font-display font-bold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
        <figure className="panel offset flex flex-col items-center justify-center gap-6 p-8 text-center">
          <blockquote className="font-display max-w-2xl text-xl leading-snug font-bold">
            &ldquo;Stuck one on the shop counter. Regulars tap it instead of asking for the menu.&rdquo;
          </blockquote>
          <figcaption className="eyebrow text-muted-foreground">Mara T. · Coffee bar, Ybor City</figcaption>
        </figure>
      </div>
    </section>
  );
}

function SectionHeading({ hint, step, title }: { hint?: string; step: string; title: string }) {
  return (
    <div className="mb-8 flex flex-col gap-2 border-b-2 border-ink pb-5">
      <span className="eyebrow text-emerald">{step}</span>
      <h2 className="text-3xl leading-[1.05] sm:text-4xl" id={step === "Step 1" ? "step-one-title" : step === "Step 2" ? "step-two-title" : "step-three-title"}>
        {title}
      </h2>
      {hint ? <p className="max-w-xl text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TagPreview({ customColors, size = "sm", style }: { customColors?: boolean; size?: "lg" | "sm"; style: ProductType }) {
  const lg = size === "lg";
  const image = previewImages[style];

  return (
    <div className={`group/tag relative shrink-0 ${lg ? "h-56 w-56 sm:h-72 sm:w-72" : "h-20 w-20"}`}>
      <span
        aria-hidden
        className={`absolute rounded-full bg-emerald/25 blur-2xl transition-opacity ${lg ? "inset-4" : "inset-2"} ${customColors ? "opacity-100" : "opacity-60"}`}
      />
      <img
        alt={image.alt}
        className={`relative h-full w-full object-contain transition-transform duration-300 ${
          lg
            ? "drop-shadow-[10px_14px_0_rgba(0,0,0,0.18)] hover:-translate-y-2 hover:rotate-[-3deg]"
            : "drop-shadow-[4px_6px_0_rgba(0,0,0,0.15)] group-hover/tag:-translate-y-1"
        } ${customColors ? "saturate-150 hue-rotate-[-25deg]" : ""}`}
        height={816}
        loading={lg ? "eager" : "lazy"}
        src={image.src}
        width={816}
      />
    </div>
  );
}

function GenericColorPanel({ design, setDesign }: { design: NfcDesign; setDesign: Dispatch<SetStateAction<NfcDesign>> }) {
  return (
    <div className="mt-6 border-2 border-ink bg-paper-deep p-5">
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <span className="flex items-center gap-4">
          <input
            checked={design.customColors}
            className="h-5 w-5 shrink-0 appearance-none border-2 border-ink bg-card checked:bg-emerald"
            onChange={(event) => setDesign({ ...design, customColors: event.target.checked })}
            type="checkbox"
          />
          <span>
            <span className="block font-display font-bold">Add custom colors</span>
            <span className="block text-sm text-muted-foreground">Pick the disc and print color at checkout.</span>
          </span>
        </span>
        <span className="font-display font-bold whitespace-nowrap">+ $5.00</span>
      </label>
      {design.customColors ? (
        <label className="mt-4 grid gap-2">
          <span className="eyebrow">Requested colors</span>
          <textarea
            className="bb-input min-h-24 resize-y placeholder:text-muted-foreground"
            onChange={(event) => setDesign({ ...design, colorDescription: event.target.value })}
            placeholder="Tell us the disc color, print color, or overall palette you want."
            value={design.colorDescription || ""}
          />
        </label>
      ) : null}
    </div>
  );
}

function CustomDesignPanel({
  busy,
  design,
  onFile,
  previewUrl,
  setDesign,
  setPreviewUrl,
  setUploadName,
  uploadName,
}: {
  busy: boolean;
  design: NfcDesign;
  onFile: (file: File | null) => Promise<void>;
  previewUrl: string;
  setDesign: Dispatch<SetStateAction<NfcDesign>>;
  setPreviewUrl: (value: string) => void;
  setUploadName: (value: string) => void;
  uploadName: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const briefMissing = design.productType === "custom" && !design.customDesignDescription?.trim();

  return (
    <div className="mt-6 border-2 border-ink bg-paper-deep p-5 sm:p-6">
      <h3 className="font-display font-bold">Describe your custom design</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Colors, symbols, text - anything we should print on the face. Required for custom tags.
      </p>
      <label className="mt-4 block">
        <span className="sr-only">Custom design description</span>
        <textarea
          aria-invalid={briefMissing}
          className="bb-input min-h-32 resize-y placeholder:text-muted-foreground"
          onChange={(event) => setDesign({ ...design, customDesignDescription: event.target.value })}
          placeholder="e.g. Matte black disc with my studio logo in emerald, name in small caps underneath."
          required
          rows={4}
          value={design.customDesignDescription || ""}
        />
      </label>
      {briefMissing ? <p className="mt-2 text-xs font-bold text-destructive">Add a few words about the design so we can print it right.</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void onFile(event.target.files?.[0] ?? null)}
          ref={fileRef}
          type="file"
        />
        <button
          className="offset-sm border-2 border-ink bg-card px-4 py-2 font-display text-sm font-bold transition-transform hover:-translate-x-[2px] hover:-translate-y-[2px]"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          Attach artwork or logo
        </button>
        <span className="text-xs text-muted-foreground">Optional · PNG, JPEG, or WebP</span>
      </div>
      {uploadName ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          {previewUrl ? <img alt="Uploaded design reference preview" className="h-20 w-20 border-2 border-ink object-cover" src={previewUrl} /> : null}
          <span className="font-display font-bold">{uploadName}</span>
          <button
            className="text-xs underline underline-offset-2 text-muted-foreground"
            onClick={() => {
              setPreviewUrl("");
              setUploadName("");
              setDesign({ ...design, uploadedAssetId: undefined });
              if (fileRef.current) fileRef.current.value = "";
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      ) : null}
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
  const localPreview = buildProgrammedDestination(design) || (social ? "https://instagram.com/yourhandle" : "https://your-site.com");

  if (!guided) {
    return (
      <label className="grid gap-2">
        <span className="eyebrow">{productLabels[design.productType]} handle or profile URL</span>
        <input
          className="bb-input placeholder:text-muted-foreground"
          onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
          placeholder={`@${design.productType === "x" ? "yourname" : "yourhandle"}`}
          value={destinationValue || ""}
        />
        <DestinationPreview value={quote?.normalizedDestination || localPreview} />
      </label>
    );
  }

  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="eyebrow">What should this tag open?</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            checked={design.destinationKind === "website"}
            label="A website"
            onChoose={() => setDesign({ ...design, destinationKind: "website" })}
          />
          <ChoiceCard
            checked={social}
            label="A social media profile"
            onChoose={() => setDesign({ ...design, destinationKind: "social", socialPlatform: design.socialPlatform || "instagram" })}
          />
        </div>
      </fieldset>

      {social ? (
        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <label className="grid gap-2">
            <span className="eyebrow">Social media site</span>
            <select
              className="bb-input min-w-52"
              disabled={fixedSocial}
              onChange={(event) => setDesign({ ...design, socialPlatform: event.target.value })}
              value={fixedSocial ? design.productType : design.socialPlatform || "instagram"}
            >
              {Object.entries(socialPlatformLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="eyebrow">Handle or profile name</span>
            <input
              className="bb-input placeholder:text-muted-foreground"
              onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
              placeholder="@yourhandle"
              value={destinationValue || ""}
            />
          </label>
          {design.socialPlatform === "other" && !fixedSocial ? (
            <label className="grid gap-2 sm:col-span-2">
              <span className="eyebrow">Which site?</span>
              <input
                className="bb-input placeholder:text-muted-foreground"
                onChange={(event) => setDesign({ ...design, socialOtherSite: event.target.value })}
                placeholder="threads.net, pinterest.com, your community page..."
                value={design.socialOtherSite || ""}
              />
            </label>
          ) : null}
        </div>
      ) : (
        <label className="grid gap-2">
          <span className="eyebrow">Website address</span>
          <input
            className="bb-input placeholder:text-muted-foreground"
            onChange={(event) => setDesign({ ...design, destinationInput: event.target.value, programmedDestination: event.target.value })}
            placeholder="https://yourwebsite.com"
            value={destinationValue || ""}
          />
          <span className="text-sm font-bold text-muted-foreground">Please double-check spelling before checkout. We program the tag exactly to the address you provide.</span>
        </label>
      )}

      <DestinationPreview value={quote?.normalizedDestination || localPreview} />
    </div>
  );
}

function DestinationPreview({ value }: { value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-2 border-dashed border-ink bg-paper-deep px-4 py-3">
      <span className="eyebrow">One tap opens</span>
      <span className="font-display text-sm font-bold break-all">→ {value}</span>
    </div>
  );
}

function ChoiceCard({ checked, label, onChoose }: { checked: boolean; label: string; onChoose: () => void }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center gap-3 border-2 border-ink p-3 font-display text-sm font-bold ${checked ? "bg-ink text-primary-foreground" : "bg-card"}`}>
      <input checked={checked} onChange={onChoose} type="checkbox" />
      {label}
    </label>
  );
}

function ContactFields({
  address,
  customer,
  setAddress,
  setCustomer,
}: {
  address: NfcAddress;
  customer: NfcCustomer;
  setAddress: Dispatch<SetStateAction<NfcAddress>>;
  setCustomer: Dispatch<SetStateAction<NfcCustomer>>;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <label className="grid gap-2 sm:col-span-1">
          <span className="eyebrow">Your name</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })} placeholder="Jordan Reyes" value={customer.fullName} />
        </label>
        <label className="grid gap-2 sm:col-span-1">
          <span className="eyebrow">Email</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="you@email.com" type="email" value={customer.email} />
        </label>
        <label className="grid gap-2 sm:col-span-1">
          <span className="eyebrow">Phone</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="(813) 555-0199" value={customer.phone} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 sm:col-span-2">
          <span className="eyebrow">Street address</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setAddress({ ...address, line1: event.target.value })} placeholder="Street address" value={address.line1} />
        </label>
        <label className="grid gap-2 sm:col-span-2">
          <span className="eyebrow">Apt, suite, optional</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setAddress({ ...address, line2: event.target.value })} placeholder="Apartment, suite, unit" value={address.line2 || ""} />
        </label>
        <label className="grid gap-2">
          <span className="eyebrow">City</span>
          <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setAddress({ ...address, city: event.target.value })} placeholder="Tampa" value={address.city} />
        </label>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <label className="grid gap-2">
            <span className="eyebrow">State</span>
            <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setAddress({ ...address, state: event.target.value })} placeholder="FL" value={address.state} />
          </label>
          <label className="grid gap-2">
            <span className="eyebrow">ZIP</span>
            <input className="bb-input placeholder:text-muted-foreground" onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} placeholder="33602" value={address.postalCode} />
          </label>
        </div>
      </div>
    </div>
  );
}

function FulfillmentChoice({ method, setMethod }: { method: FulfillmentMethod; setMethod: Dispatch<SetStateAction<FulfillmentMethod>> }) {
  const choices = [
    {
      detail: "Hand-dropped in the Tampa Bay area when your address qualifies.",
      eta: "1-3 days",
      id: "local_delivery" as const,
      name: "Local delivery",
      price: "Calculated",
    },
    {
      detail: "Tracked envelope, shipped anywhere in the US.",
      eta: "3-6 days",
      id: "usps_standard" as const,
      name: "USPS standard",
      price: "Fixed fee",
    },
  ];

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {choices.map((choice) => {
        const active = choice.id === method;
        return (
          <button
            aria-pressed={active}
            className={`border-2 border-ink p-5 text-left transition-transform ${
              active ? "offset-sm -translate-x-[2px] -translate-y-[2px] bg-sky" : "bg-card hover:-translate-y-[2px]"
            }`}
            key={choice.id}
            onClick={() => setMethod(choice.id)}
            type="button"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="font-display text-base font-bold">{choice.name}</span>
              <span className="font-display text-sm font-bold">{choice.price}</span>
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{choice.detail}</span>
            <span className="eyebrow mt-3 block text-emerald">{choice.eta}</span>
          </button>
        );
      })}
    </div>
  );
}

function OrderSummary({ attributionToken, method, quote }: { attributionToken: string; method: FulfillmentMethod; quote: QuoteResponse | null }) {
  return (
    <aside className="panel offset lg:sticky lg:top-8">
      <div className="border-b-2 border-ink bg-ink px-6 py-4">
        <h2 className="eyebrow text-primary-foreground">Order summary</h2>
      </div>
      <div className="p-6">
        <dl className="space-y-3">
          <SummaryRow label="Base price" value={quote?.money.basePriceCents} />
          {quote?.money.customColorSurchargeCents ? <SummaryRow label="Custom colors" value={quote.money.customColorSurchargeCents} /> : null}
          <SummaryRow label="Delivery or shipping" value={quote?.money.deliveryFeeCents} />
          <SummaryRow label="Estimated tax" value={quote?.money.estimatedTaxCents} />
        </dl>
        <div className="mt-5 flex items-baseline justify-between border-t-2 border-ink pt-5">
          <span className="font-display text-lg font-bold">Total</span>
          <span className="font-display text-3xl font-bold">{formatMoney(quote?.money.totalCents)}</span>
        </div>
        <p className="mt-4 text-sm font-bold text-muted-foreground">
          {attributionToken ? "Referral attribution is active for this checkout." : "No referral attribution is active."}
        </p>
        {method === "local_delivery" ? (
          <p className="mt-3 border-2 border-dashed border-ink bg-paper-deep p-3 text-xs font-bold text-muted-foreground">
            Local delivery is confirmed server-side after address review.
          </p>
        ) : null}
        {quote?.fulfillmentEligibility.status === "outside_local_delivery_area" ? (
          <p className="mt-3 border-2 border-ink bg-sky p-3 font-display text-sm font-bold">Outside local delivery range. USPS is available.</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">Nothing is charged until you review payment details.</p>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-display font-bold">{formatMoney(value)}</dd>
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
    <section className="mt-6 border-2 border-ink bg-paper-deep p-5" aria-labelledby="payment-title">
      <h2 className="font-display text-xl font-bold" id="payment-title">Payment</h2>
      <p className="mb-4 mt-1 text-sm font-bold text-muted-foreground">Order {orderId}</p>
      <PaymentElement />
      {error ? <p className="mt-3 font-display text-sm font-bold text-destructive">{error}</p> : null}
      <button className="bb-button bb-button-primary offset-sm mt-4 w-full hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={busy || !stripe || !elements} onClick={() => void submit()} type="button">
        {busy ? "Confirming..." : "Pay securely"}
      </button>
    </section>
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
