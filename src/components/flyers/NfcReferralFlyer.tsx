/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const PAGE_W = 816;
const PAGE_H = 1056;

const USES = [
  "Instagram",
  "Snapchat",
  "X",
  "Websites",
  "Menus",
  "Payment links",
  "Contact cards",
];

const STEPS = [
  ["01", "Pick your tag", "Platform icon or a fully custom design."],
  ["02", "Send your link", "Profile, menu, site, payment - anything."],
  ["03", "Tap to share", "Any modern phone. No app, no typing."],
];

const TAGS = [
  ["/assets/tag-instagram.png", "Instagram"],
  ["/assets/tag-snapchat.png", "Snapchat"],
  ["/assets/tag-x.png", "X"],
  ["/assets/tag-plain.png", "Blank / custom"],
];

export type NfcReferralFlyerProps = {
  fitToViewport?: boolean;
  qrTitle?: string;
  qrUrl?: string;
  refCode?: string;
  scanLabel?: string;
  scanLabelVariant?: "caption" | "loud";
  siteUrl?: string;
};

export function NfcReferralFlyer({
  fitToViewport = true,
  qrTitle,
  qrUrl,
  refCode,
  scanLabel = "Scan to order yours",
  scanLabelVariant = "caption",
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nfc.bayblaze.net",
}: NfcReferralFlyerProps) {
  const shellRef = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);
  const baseUrl = siteUrl.replace(/\/+$/, "");
  const qrValue = qrUrl || (refCode ? `${baseUrl}/r/${encodeURIComponent(refCode)}` : "");

  useEffect(() => {
    if (!fitToViewport) {
      return;
    }
    const fit = () => {
      const el = shellRef.current;
      if (!el) return;
      const availW = el.clientWidth - 32;
      const availH = window.innerHeight - 32;
      setScale(Math.min(1, availW / PAGE_W, availH / PAGE_H));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fitToViewport]);

  return (
    <main
      className="flyer-shell flex min-h-screen w-full items-start justify-center bg-bb-paper p-4"
      ref={shellRef}
    >
      <div
        className="flyer-scaler"
        style={{ width: PAGE_W * scale, height: PAGE_H * scale }}
      >
        <div
          className="flyer-page"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="flex h-full w-full flex-col px-[0.62in] pb-[0.26in] pt-[0.55in]">
            <header className="flex items-center justify-between">
              <div>
                <div className="font-display text-[26px] font-bold tracking-[-0.02em]">
                  BayBlaze
                </div>
                <div className="mt-0.5 text-[10.5px] font-medium uppercase tracking-[0.34em] text-bb-muted">
                  Custom NFC Tags
                </div>
              </div>
              <span className="panel-sm bg-bb-mint px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em]">
                Tampa, FL · Ships nationwide
              </span>
            </header>

            <section className="panel mt-5 flex items-stretch overflow-hidden">
              <div className="flex-1 px-7 py-4">
                <h1 className="font-display text-[47px] font-bold leading-[0.98] tracking-[-0.035em]">
                  Share any link
                  <br />
                  with <span className="text-bb-emerald">one tap.</span>
                </h1>
                <p className="mt-4 max-w-[3.6in] text-[13.5px] leading-relaxed text-bb-muted">
                  3D-printed NFC tags that instantly open your profile, website, menu or payment link. No app. No typing. No paper cards.
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="panel-sm bg-bb-emerald px-3.5 py-2 font-display text-[13px] font-bold text-bb-white">
                    From $20
                  </span>
                  <span className="text-[11.5px] font-medium text-bb-muted">
                    Custom color or design +$5
                  </span>
                </div>
              </div>
              <div className="flex w-[3.1in] shrink-0 items-center justify-center border-l-2 border-bb-ink bg-bb-mint">
                <img
                  alt="Green 3D-printed BayBlaze NFC keychain tag with a white star"
                  className="h-[1.8in] w-[1.8in] object-contain"
                  src="/assets/tag-custom.png"
                />
              </div>
            </section>

            <section className="mt-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.18em]">
                  Pick your style
                </h2>
                <p className="text-[11px] text-bb-muted">Any color · any icon · any link</p>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-3">
                {TAGS.map(([src, label]) => (
                  <figure
                    className="panel-sm flex flex-col items-center bg-bb-white px-2 pb-2 pt-3"
                    key={label}
                  >
                    <img
                      alt={`${label} BayBlaze NFC keychain tag`}
                      className="h-[0.72in] w-[0.72in] object-contain"
                      src={src}
                    />
                    <figcaption className="mt-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-bb-muted">
                      {label}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-3">
              {STEPS.map(([number, title, detail]) => (
                <div className="panel-sm bg-bb-white px-3.5 py-2.5" key={number}>
                  <div className="font-display text-[12px] font-bold text-bb-emerald">{number}</div>
                  <div className="mt-1 font-display text-[13.5px] font-bold leading-tight">
                    {title}
                  </div>
                  <p className="mt-1 text-[10.5px] leading-snug text-bb-muted">{detail}</p>
                </div>
              ))}
            </section>

            <section className="panel mt-4 flex flex-1 items-stretch overflow-hidden">
              <div className="flex w-[3.35in] shrink-0 flex-col items-center justify-center gap-2 border-r-2 border-bb-ink bg-bb-white px-3 py-2">
                <div
                  data-qr-placeholder="true"
                  data-qr-value={qrValue || undefined}
                  id="qr-code-slot"
                  style={{ width: "2.32in", aspectRatio: "1 / 1", background: "#ffffff" }}
                >
                  {qrValue ? (
                    <QRCodeSVG
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="H"
                      marginSize={4}
                      role="img"
                      size={250}
                      style={{ display: "block", height: "100%", width: "100%" }}
                      title={qrTitle || `BayBlaze NFC referral QR for ${refCode}`}
                      value={qrValue}
                    />
                  ) : null}
                </div>
                <p
                  className={
                    scanLabelVariant === "loud"
                      ? "panel-sm max-w-[2.9in] bg-bb-emerald px-3 py-2.5 text-center font-display text-[18px] font-bold uppercase leading-[0.98] tracking-[0.04em] text-bb-white"
                      : "text-[11px] font-medium uppercase tracking-[0.2em] text-bb-muted"
                  }
                >
                  {scanLabel}
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between bg-bb-sky px-6 py-5">
                <div>
                  <h2 className="font-display text-[14px] font-bold uppercase tracking-[0.18em]">
                    Point it anywhere
                  </h2>
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {USES.map((use) => (
                      <li
                        className="panel-sm bg-bb-white px-2 py-0.5 text-[10.5px] font-medium"
                        key={use}
                      >
                        {use}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[12px] leading-relaxed text-bb-muted">
                    Made for creators, salons, restaurants, realtors, DJs and promoters who are tired of spelling out usernames.
                  </p>
                </div>
                <p className="font-display text-[24px] font-bold leading-[1.05] tracking-[-0.03em]">
                  Tap. Connect.
                  <br />
                  <span className="text-bb-emerald">Get remembered.</span>
                </p>
              </div>
            </section>

            <footer className="mt-2 flex items-center justify-between text-[10.5px] font-medium uppercase tracking-[0.22em] text-bb-muted">
              <span>BayBlaze · Custom NFC Tags</span>
              <span>3D-printed in Tampa, FL</span>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
