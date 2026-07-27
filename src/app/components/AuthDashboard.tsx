/* eslint-disable @next/next/no-img-element */
"use client";

import QRCode from "qrcode";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createPartnerClaimCode, loadAdminDashboard, loadPartnerPortal, login, loginCustomer, registerCustomer, type PartnerClaimCode } from "@/app/lib/api";
import type { PartnerPortalData } from "@/app/lib/contracts";
import { formatDate, formatMoney } from "@/app/lib/format";

type Mode = "partner" | "admin";

export default function AuthDashboard({ mode }: { mode: Mode }) {
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("bb_account_token") || "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState<PartnerPortalData | null>(null);
  const [admin, setAdmin] = useState<Awaited<ReturnType<typeof loadAdminDashboard>> | null>(null);
  const [qr, setQr] = useState("");
  const [claimQrs, setClaimQrs] = useState<Record<string, string>>({});
  const [claimBusy, setClaimBusy] = useState(false);
  const [pdfBusyCode, setPdfBusyCode] = useState("");
  const title = mode === "partner" ? "Affiliate Portal" : "NFC Admin";
  const subtitle = mode === "partner"
    ? "Track your referral QR, attributed orders, and payout history."
    : "Review NFC orders, commissions, payouts, and printable claim QR codes.";

  useEffect(() => {
    if (!token) return;
    if (mode === "partner") {
      loadPartnerPortal(token)
        .then(setPartner)
        .catch((caught: Error) => setError(caught.message));
    } else {
      loadAdminDashboard(token)
        .then(setAdmin)
        .catch((caught: Error) => setError(caught.message));
    }
  }, [mode, token]);

  const referralLink = partner?.referralLink?.replace("bayblaze.net/?", "nfc.bayblaze.net/?");
  useEffect(() => {
    if (!referralLink) return;
    QRCode.toDataURL(referralLink, { errorCorrectionLevel: "H", margin: 1, width: 720 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [referralLink]);

  const nextPayoutDate = useMemo(() => {
    const latest = partner?.payouts?.[0]?.createdAt;
    if (!latest) return "Available when commissions are eligible";
    const date = new Date(latest);
    date.setDate(date.getDate() + 7);
    return formatDate(date.toISOString());
  }, [partner?.payouts]);

  async function submitAuth(input: AuthFormState & { authMode: AuthMode }) {
    setError("");
    try {
      const result = input.authMode === "register"
        ? await registerCustomer({
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            password: input.password,
          })
        : mode === "partner"
          ? await loginCustomer(input.email, input.password)
          : await login(input.email, input.password);
      window.localStorage.setItem("bb_account_token", result.token);
      setToken(result.token);
    } catch (caught) {
      throw caught instanceof Error ? caught : new Error("Could not sign in.");
    }
  }

  async function copyReferral() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setMessage("Referral link copied.");
  }

  function downloadQr() {
    if (!qr || !partner?.referralCode) return;
    const anchor = document.createElement("a");
    anchor.download = `bayblaze-nfc-${partner.referralCode.toLowerCase()}-qr.png`;
    anchor.href = qr;
    anchor.click();
    setMessage("QR code download started.");
  }

  async function generateClaimCode({ downloadFlyer = false }: { downloadFlyer?: boolean } = {}) {
    if (!token) return;
    setError("");
    setMessage("");
    setClaimBusy(true);
    try {
      const result = await createPartnerClaimCode(token);
      setAdmin((current) => current
        ? {
            ...current,
            claimCodes: [
              result.claimCode,
              ...(current.claimCodes || []).filter((item) => item.code !== result.claimCode.code),
            ],
          }
        : current);
      if (downloadFlyer) {
        await downloadClaimFlyerPdf(result.claimCode.code);
        setMessage(`Claim flyer ${result.claimCode.code} downloaded.`);
      } else {
        setMessage(`Claim QR ${result.claimCode.code} is ready to print.`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a claim QR.");
    } finally {
      setClaimBusy(false);
    }
  }

  async function downloadExistingClaimFlyer(code: string) {
    setError("");
    setMessage("");
    setPdfBusyCode(code);
    try {
      await downloadClaimFlyerPdf(code);
      setMessage(`Claim flyer ${code} downloaded.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not download that flyer PDF.");
    } finally {
      setPdfBusyCode("");
    }
  }

  useEffect(() => {
    const claimCodes = admin?.claimCodes || [];
    if (!claimCodes.length) {
      return;
    }
    let cancelled = false;
    Promise.all(
      claimCodes.map(async (item) => [
        item.code,
        await QRCode.toDataURL(item.claimUrl, { errorCorrectionLevel: "H", margin: 1, width: 320 }),
      ] as const),
    )
      .then((entries) => {
        if (!cancelled) setClaimQrs(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setClaimQrs({});
      });
    return () => {
      cancelled = true;
    };
  }, [admin?.claimCodes]);

  function signOut() {
    window.localStorage.removeItem("bb_account_token");
    setToken("");
    setPartner(null);
    setAdmin(null);
    setMessage("");
    setError("");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link className="font-display text-sm font-bold tracking-[0.18em] uppercase" href="/">
            BayBlaze<span className="text-emerald"> NFC</span>
          </Link>
          <span className="text-xs text-muted-foreground">Programmed by hand · Tampa Bay · Ships nationwide</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-10 sm:py-14">
        <section className="panel offset overflow-hidden">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_auto]">
            <div>
              <span className="eyebrow text-emerald">BayBlaze NFC</span>
              <h1 className="mt-5 text-5xl leading-[0.95] sm:text-6xl">{title}</h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
            </div>
            <div className="hidden justify-end lg:flex">
              <img
                alt="3D printed green NFC keychain tag with a custom star design"
                className="h-44 w-44 object-contain drop-shadow-[8px_10px_0_rgba(0,0,0,0.18)]"
                height={816}
                src="/assets/tag-custom.png"
                width={816}
              />
            </div>
          </div>
          {token ? (
            <div className="border-t-2 border-ink bg-sky px-8 py-5 sm:px-12">
              <div className="flex justify-end">
                <button className="bb-button offset-sm bg-card hover:-translate-x-[2px] hover:-translate-y-[2px]" onClick={signOut} type="button">Sign out</button>
              </div>
            </div>
          ) : null}
        </section>

        {error ? <p className="panel offset-sm border-destructive bg-card p-4 font-display text-sm font-bold text-destructive">{error}</p> : null}
        {message ? <p className="panel offset-sm bg-sky p-4 font-display text-sm font-bold">{message}</p> : null}

        {!token ? (
          <BayBlazeSignOnElement
            allowRegister={mode === "partner"}
            heading={mode === "partner" ? "Sign in" : "Admin sign in"}
            onSubmit={submitAuth}
            submitError={error}
          />
        ) : null}

        {mode === "partner" && partner ? (
          <PartnerDashboard
            downloadQr={downloadQr}
            nextPayoutDate={nextPayoutDate}
            onCopyReferral={() => void copyReferral()}
            partner={partner}
            qr={qr}
            referralLink={referralLink}
          />
        ) : null}

        {mode === "admin" && admin ? (
          <AdminDashboard
            admin={admin}
            claimBusy={claimBusy}
            claimQrs={claimQrs}
            generateClaimCode={() => void generateClaimCode()}
            generateClaimFlyer={() => void generateClaimCode({ downloadFlyer: true })}
            onDownloadClaimFlyer={(code) => void downloadExistingClaimFlyer(code)}
            onCopyClaimLink={(url) => {
              void navigator.clipboard.writeText(url).then(() => setMessage("Claim link copied."));
            }}
            pdfBusyCode={pdfBusyCode}
          />
        ) : null}
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

function PartnerDashboard({
  downloadQr,
  nextPayoutDate,
  onCopyReferral,
  partner,
  qr,
  referralLink,
}: {
  downloadQr: () => void;
  nextPayoutDate: string;
  onCopyReferral: () => void;
  partner: PartnerPortalData;
  qr: string;
  referralLink?: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="panel offset h-fit overflow-hidden">
        <div className="border-b-2 border-ink bg-ink px-6 py-4">
          <h2 className="eyebrow text-primary-foreground">Referral QR</h2>
        </div>
        <div className="p-6">
          <h3 className="font-display text-2xl font-bold">{partner.partner?.displayName || partner.account?.displayName || "Affiliate"}</h3>
          <p className="mt-1 font-bold text-muted-foreground">Status: {partner.partner?.status || partner.account?.status || "pending"}</p>
          {qr ? <img alt={`QR code for ${partner.referralCode}`} className="mt-5 w-full border-2 border-ink bg-card" src={qr} /> : <EmptyState copy="Referral QR is not ready yet." />}
          <p className="mt-4 break-all border-2 border-ink bg-paper-deep p-3 font-mono text-sm">{referralLink || "Referral link pending"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <button className="bb-button bb-button-primary offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={!referralLink} onClick={onCopyReferral} type="button">Copy link</button>
            <button className="bb-button offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={!qr} onClick={downloadQr} type="button">Download QR</button>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Purchases" value={String(partner.metrics?.completedOrders ?? 0)} />
          <Metric label="Pending" value={formatMoney(partner.earnings?.pendingCents)} />
          <Metric label="Available" value={formatMoney(partner.earnings?.eligibleCents)} />
          <Metric label="Paid" value={formatMoney(partner.earnings?.paidCents)} />
        </div>

        <section className="panel offset p-6">
          <SectionHeading hint={`Next request date: ${nextPayoutDate}`} step="Payouts" title="Weekly payout requests" />
          <DataTable
            empty="No payout requests yet."
            rows={(partner.payouts || []).map((item) => [formatDate(item.createdAt), formatMoney(item.amountCents), item.status])}
          />
        </section>

        <section className="panel offset p-6">
          <SectionHeading hint="Customer details are intentionally limited for privacy." step="Ledger" title="Commission ledger" />
          <DataTable
            empty="No attributed purchases yet."
            rows={(partner.referrals || []).map((item) => [formatDate(item.date), item.customerLabel, item.orderStatus, item.commissionStatus, formatMoney(item.earnedCents)])}
          />
        </section>
      </section>
    </div>
  );
}

function AdminDashboard({
  admin,
  claimBusy,
  claimQrs,
  generateClaimCode,
  generateClaimFlyer,
  onDownloadClaimFlyer,
  onCopyClaimLink,
  pdfBusyCode,
}: {
  admin: Awaited<ReturnType<typeof loadAdminDashboard>>;
  claimBusy: boolean;
  claimQrs: Record<string, string>;
  generateClaimCode: () => void;
  generateClaimFlyer: () => void;
  onDownloadClaimFlyer: (code: string) => void;
  onCopyClaimLink: (url: string) => void;
  pdfBusyCode: string;
}) {
  const claimCodes = admin.claimCodes || [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="NFC orders" value={String(admin.metrics.orders)} />
        <Metric label="Paid sales" value={formatMoney(admin.metrics.paidSalesCents)} />
        <Metric label="Pending commissions" value={formatMoney(admin.metrics.pendingCommissionsCents)} />
      </div>

      <section className="panel offset overflow-hidden">
        <div className="border-b-2 border-ink bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow text-emerald">Claim codes</span>
              <h2 className="mt-2 text-3xl leading-[1.05]">Created flyer QR codes</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {claimCodes.length} flyer QR code{claimCodes.length === 1 ? "" : "s"} ready to download as PDFs, share, or review.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="bb-button bb-button-primary offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]"
                disabled={claimBusy}
                onClick={generateClaimCode}
                type="button"
              >
                {claimBusy ? "Creating..." : "Create claim QR"}
              </button>
              <button
                className="bb-button offset-sm bg-card hover:-translate-x-[2px] hover:-translate-y-[2px]"
                disabled={claimBusy}
                onClick={generateClaimFlyer}
                type="button"
              >
                {claimBusy ? "Creating..." : "Create Flyer PDF"}
              </button>
            </div>
          </div>
        </div>

        {claimCodes.length ? (
          <div className="grid gap-4 bg-paper-deep p-4 sm:grid-cols-2 xl:grid-cols-3">
            {claimCodes.map((item) => (
              <ClaimCodeCard
                item={item}
                key={item.code}
                onDownloadClaimFlyer={onDownloadClaimFlyer}
                onCopyClaimLink={onCopyClaimLink}
                pdfBusy={pdfBusyCode === item.code}
                qr={claimQrs[item.code] || ""}
              />
            ))}
          </div>
        ) : (
          <div className="bg-paper-deep p-6">
            <EmptyState copy="No flyer QR codes have been created yet." />
          </div>
        )}
      </section>

      <section className="panel offset p-6">
        <SectionHeading hint="Recent order activity from bayblaze-api." step="Orders" title="Recent orders" />
        <DataTable empty="No recent orders." rows={unknownRows(admin.orders)} />
      </section>

      <section className="panel offset p-6">
        <SectionHeading hint="Commission entries awaiting review or payout." step="Commissions" title="Commission queue" />
        <DataTable empty="No commission entries." rows={unknownRows(admin.commissionLedger)} />
      </section>
    </div>
  );
}

function ClaimCodeCard({
  item,
  onDownloadClaimFlyer,
  onCopyClaimLink,
  pdfBusy,
  qr,
}: {
  item: PartnerClaimCode;
  onDownloadClaimFlyer: (code: string) => void;
  onCopyClaimLink: (url: string) => void;
  pdfBusy: boolean;
  qr: string;
}) {
  const statusClass = item.status === "claimed"
    ? "bg-emerald text-emerald-foreground"
    : item.status === "disabled"
      ? "bg-destructive text-destructive-foreground"
      : item.status === "claiming"
        ? "bg-sky text-ink"
        : "bg-card text-ink";

  return (
    <article className="panel offset-sm flex min-h-full flex-col overflow-hidden bg-card">
      <div className="flex items-start justify-between gap-3 border-b-2 border-ink p-4">
        <div className="min-w-0">
          <p className="eyebrow text-emerald">Flyer QR</p>
          <h3 className="mt-1 break-all font-mono text-2xl font-bold tracking-tight">{item.code}</h3>
        </div>
        <span className={`border-2 border-ink px-2 py-1 font-display text-[11px] font-bold uppercase tracking-[0.12em] ${statusClass}`}>
          {item.status}
        </span>
      </div>

      <div className="grid flex-1 gap-4 p-4 sm:grid-cols-[116px_1fr]">
        <div className="grid h-[116px] w-[116px] place-items-center border-2 border-ink bg-white">
          {qr ? (
            <img alt={`Claim QR code ${item.code}`} className="h-full w-full object-contain" src={qr} />
          ) : (
            <span className="px-2 text-center font-display text-xs font-bold text-muted-foreground">QR loading</span>
          )}
        </div>

        <dl className="grid content-start gap-2 text-sm">
          <div>
            <dt className="eyebrow text-muted-foreground">Created</dt>
            <dd className="font-bold">{formatDate(item.createdAt)}</dd>
          </div>
          {item.claimedAt ? (
            <div>
              <dt className="eyebrow text-muted-foreground">Claimed</dt>
              <dd className="font-bold">{formatDate(item.claimedAt)}</dd>
            </div>
          ) : null}
          {item.claimedByUid ? (
            <div>
              <dt className="eyebrow text-muted-foreground">Account</dt>
              <dd className="break-all font-mono text-xs font-bold">{item.claimedByUid}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <p className="border-t-2 border-ink bg-paper-deep p-3 font-mono text-xs break-all">{item.claimUrl}</p>

      <div className="grid gap-2 border-t-2 border-ink p-4 sm:grid-cols-2">
        <button className="bb-button offset-sm min-h-10 px-2 py-2 text-xs hover:-translate-x-[2px] hover:-translate-y-[2px]" onClick={() => onCopyClaimLink(item.claimUrl)} type="button">Copy</button>
        <button className="bb-button bb-button-primary offset-sm min-h-10 px-2 py-2 text-xs hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={pdfBusy} onClick={() => onDownloadClaimFlyer(item.code)} type="button">
          {pdfBusy ? "Downloading..." : "Download PDF"}
        </button>
        <Link className="bb-button offset-sm min-h-10 px-2 py-2 text-xs hover:-translate-x-[2px] hover:-translate-y-[2px]" href={`/flyer/claim/${encodeURIComponent(item.code)}`} target="_blank">Preview</Link>
        <Link className="bb-button bb-button-primary offset-sm min-h-10 px-2 py-2 text-xs hover:-translate-x-[2px] hover:-translate-y-[2px]" href={item.claimUrl} target="_blank">Open</Link>
      </div>
    </article>
  );
}

async function downloadClaimFlyerPdf(code: string) {
  const baseUrl = window.location.origin;
  const claimUrl = `${baseUrl}/partners/claim?code=${encodeURIComponent(code)}`;
  const [{ jsPDF }, qrDataUrl, customTag, instagramTag, snapchatTag, xTag, plainTag] = await Promise.all([
    import("jspdf"),
    QRCode.toDataURL(claimUrl, { errorCorrectionLevel: "H", margin: 2, width: 900 }),
    imageToDataUrl("/assets/tag-custom.png"),
    imageToDataUrl("/assets/tag-instagram.png"),
    imageToDataUrl("/assets/tag-snapchat.png"),
    imageToDataUrl("/assets/tag-x.png"),
    imageToDataUrl("/assets/tag-plain.png"),
  ]);

  const pdf = new jsPDF({ compress: true, format: "letter", orientation: "portrait", unit: "in" });
  const ink = "#000000";
  const paper = "#f8f8f3";
  const emerald = "#129765";
  const sky = "#d4eef7";
  const mint = "#d9f6e9";
  const muted = "#77736a";

  pdf.setFillColor(paper);
  pdf.rect(0, 0, 8.5, 11, "F");
  pdf.setLineWidth(0.02);
  pdf.setDrawColor(ink);
  pdf.setTextColor(ink);

  const panel = (x: number, y: number, w: number, h: number, fill = "#ffffff") => {
    pdf.setFillColor(fill);
    pdf.rect(x + 0.035, y + 0.035, w, h, "F");
    pdf.setFillColor(fill);
    pdf.rect(x, y, w, h, "FD");
  };
  const label = (text: string, x: number, y: number, size = 0.12, color = ink) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(size * 72);
    pdf.setTextColor(color);
    pdf.text(text, x, y, { charSpace: 0.8 });
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("BayBlaze", 0.62, 0.95);
  pdf.setFontSize(8);
  pdf.setTextColor(muted);
  pdf.text("C U S T O M  N F C  T A G S", 0.62, 1.18);

  panel(5.34, 0.82, 2.48, 0.31, mint);
  pdf.setFontSize(8);
  pdf.setTextColor(ink);
  pdf.text("TAMPA, FL · SHIPS NATIONWIDE", 5.48, 1.02);

  panel(0.62, 1.46, 4.12, 2.72);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(34);
  pdf.setTextColor(ink);
  pdf.text("Share any link", 0.9, 2.0);
  pdf.text("with", 0.9, 2.45);
  pdf.setTextColor(emerald);
  pdf.text("one tap.", 1.95, 2.45);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(muted);
  pdf.text("3D-printed NFC tags that instantly open your profile,", 0.9, 2.87);
  pdf.text("website, menu or payment link. No app. No typing. No", 0.9, 3.1);
  pdf.text("paper cards.", 0.9, 3.33);
  panel(0.9, 3.64, 0.94, 0.39, emerald);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor("#ffffff");
  pdf.text("From $20", 1.05, 3.89);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(muted);
  pdf.text("Custom color or design +$5", 1.96, 3.88);

  panel(4.74, 1.46, 3.14, 2.72, mint);
  pdf.addImage(customTag, "PNG", 5.55, 2.08, 1.58, 1.58);

  label("PICK YOUR STYLE", 0.62, 4.52, 0.12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(muted);
  pdf.text("Any color · any icon · any link", 6.28, 4.52);

  const tagCards = [
    { image: instagramTag, label: "INSTAGRAM", x: 0.62 },
    { image: snapchatTag, label: "SNAPCHAT", x: 2.42 },
    { image: xTag, label: "X", x: 4.22 },
    { image: plainTag, label: "BLANK / CUSTOM", x: 6.02 },
  ];
  tagCards.forEach((tag) => {
    panel(tag.x, 4.75, 1.66, 1.16);
    pdf.addImage(tag.image, "PNG", tag.x + 0.49, 4.9, 0.68, 0.68);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(muted);
    pdf.text(tag.label, tag.x + 0.83, 5.72, { align: "center", charSpace: 0.6 });
  });

  const steps = [
    ["01", "Pick your tag", "Platform icon or a fully custom\ndesign.", 0.62, 6.08],
    ["02", "Send your link", "Profile, menu, site, payment -\nanything.", 3.05, 6.08],
    ["03", "Tap to share", "Any modern phone. No app, no\ntyping.", 5.48, 6.08],
  ] as const;
  steps.forEach(([number, title, copy, x, y]) => {
    panel(x, y, 2.25, 0.95);
    label(number, x + 0.14, y + 0.24, 0.09, emerald);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(ink);
    pdf.text(title, x + 0.14, y + 0.48);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(muted);
    pdf.text(copy, x + 0.14, y + 0.68);
  });

  panel(0.62, 7.18, 3.35, 2.9);
  pdf.addImage(qrDataUrl, "PNG", 1.28, 7.46, 2.0, 2.0);
  panel(0.86, 9.57, 2.85, 0.55, emerald);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor("#ffffff");
  pdf.text("SCAN TO GET YOUR OWN", 2.285, 9.84, { align: "center" });
  pdf.text("CUSTOM TAG!", 2.285, 10.04, { align: "center" });

  panel(3.97, 7.18, 3.91, 2.9, sky);
  label("POINT IT ANYWHERE", 4.25, 7.56, 0.12);
  ["Instagram", "Snapchat", "X", "Websites", "Menus", "Payment links", "Contact cards"].forEach((use, index) => {
    const positions = [
      [4.25, 7.74, 0.72], [5.05, 7.74, 0.77], [5.9, 7.74, 0.33], [6.32, 7.74, 0.75],
      [7.15, 7.74, 0.52], [4.25, 8.05, 0.95], [5.28, 8.05, 0.98],
    ] as const;
    const [x, y, w] = positions[index];
    panel(x, y, w, 0.23);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(ink);
    pdf.text(use, x + 0.06, y + 0.16);
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(muted);
  pdf.text("Made for creators, salons, restaurants, realtors, DJs and", 4.25, 8.62);
  pdf.text("promoters who are tired of spelling out usernames.", 4.25, 8.85);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(ink);
  pdf.text("Tap. Connect.", 4.25, 9.65);
  pdf.setTextColor(emerald);
  pdf.text("Get remembered.", 4.25, 9.9);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(muted);
  pdf.text("B A Y B L A Z E  ·  C U S T O M  N F C  T A G S", 0.62, 10.33);
  pdf.text("3 D - P R I N T E D  I N  T A M P A ,  F L", 5.85, 10.33);
  pdf.save(`bayblaze-claim-flyer-${code.toLowerCase()}.pdf`);
}

async function imageToDataUrl(src: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load flyer artwork.");
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Could not read flyer artwork.")));
    reader.readAsDataURL(blob);
  });
}

export type AuthMode = "login" | "register";

export type AuthFormState = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

const initialAuthForm: AuthFormState = {
  email: "",
  firstName: "",
  lastName: "",
  password: "",
};

export function BayBlazeSignOnElement({
  allowRegister,
  heading,
  onSubmit,
  submitError,
  width = "default",
}: {
  allowRegister: boolean;
  heading: string;
  onSubmit: (input: AuthFormState & { authMode: AuthMode }) => Promise<void>;
  submitError: string;
  width?: "default" | "wide";
}) {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<AuthFormState>(initialAuthForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const redirectTo = `${pathname}${query ? `?${query}` : ""}`;
  const googleHref = `/api/auth/oauth/google/start?redirect=${encodeURIComponent(redirectTo)}`;

  function updateField(field: keyof AuthFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, authMode });
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : "We could not complete that request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="bayblaze-auth-heading"
      className={`panel offset mx-auto w-full p-6 sm:p-8 ${
        width === "wide" ? "max-w-[720px]" : "max-w-[560px]"
      }`}
    >
      <span className="eyebrow text-emerald">BayBlaze account</span>
      <h2 className="mt-3 text-center text-4xl leading-none sm:text-5xl" id="bayblaze-auth-heading">{heading}</h2>

      {allowRegister ? (
        <div className="mt-6 grid grid-cols-2 border-2 border-ink bg-card">
          <button
            aria-pressed={authMode === "login"}
            className={`h-12 border-r-2 border-ink font-display text-sm font-bold uppercase tracking-[0.16em] transition-colors ${authMode === "login" ? "bg-ink text-primary-foreground" : "bg-card hover:bg-sky"}`}
            onClick={() => {
              setAuthMode("login");
              setLocalError("");
            }}
            type="button"
          >
            Login
          </button>
          <button
            aria-pressed={authMode === "register"}
            className={`h-12 font-display text-sm font-bold uppercase tracking-[0.16em] transition-colors ${authMode === "register" ? "bg-ink text-primary-foreground" : "bg-card hover:bg-sky"}`}
            onClick={() => {
              setAuthMode("register");
              setLocalError("");
            }}
            type="button"
          >
            Register
          </button>
        </div>
      ) : null}

      <a
        className="mt-5 flex h-12 w-full items-center justify-center gap-3 border-2 border-ink bg-card px-4 text-center font-display text-sm font-bold uppercase tracking-[0.12em] transition-colors hover:bg-ink hover:text-primary-foreground"
        href={googleHref}
      >
        <span aria-hidden="true" className="grid size-5 place-items-center border-2 border-ink bg-card text-xs font-bold leading-none text-ink">G</span>
        Continue with Google
      </a>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <span className="h-0.5 flex-1 bg-ink" />
        <span>Email</span>
        <span className="h-0.5 flex-1 bg-ink" />
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {authMode === "register" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput autoComplete="given-name" label="First name" onChange={(value) => updateField("firstName", value)} value={form.firstName} />
            <AuthInput autoComplete="family-name" label="Last name" onChange={(value) => updateField("lastName", value)} value={form.lastName} />
          </div>
        ) : null}
        <AuthInput autoComplete="email" label="Email" onChange={(value) => updateField("email", value)} type="email" value={form.email} />
        <AuthInput
          autoComplete={authMode === "login" ? "current-password" : "new-password"}
          label="Password"
          minLength={authMode === "login" ? 6 : 12}
          onChange={(value) => updateField("password", value)}
          type="password"
          value={form.password}
        />

        <p aria-live="polite" className="min-h-6 break-all text-sm font-bold text-destructive">{localError || submitError}</p>

        <button className="bb-button bb-button-primary offset-sm flex h-[52px] w-full hover:-translate-x-[2px] hover:-translate-y-[2px]" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? authMode === "login" ? "Signing in..." : "Creating account..."
            : authMode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </section>
  );
}

function AuthInput({
  autoComplete,
  label,
  minLength,
  onChange,
  type = "text",
  value,
}: {
  autoComplete?: string;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        autoComplete={autoComplete}
        className="bb-input mt-2 h-12"
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

function SectionHeading({ hint, step, title }: { hint?: string; step: string; title: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b-2 border-ink pb-5">
      <span className="eyebrow text-emerald">{step}</span>
      <h2 className="text-3xl leading-[1.05]">{title}</h2>
      {hint ? <p className="max-w-2xl text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel offset-sm bg-card p-5">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function DataTable({ empty, rows }: { empty: string; rows: string[][] }) {
  if (!rows.length) return <EmptyState copy={empty} />;
  return (
    <div className="overflow-x-auto border-2 border-ink bg-card">
      <table className="w-full min-w-[620px] text-left text-sm">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-t-2 border-ink first:border-t-0" key={`${row.join(":")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => <td className="p-3 font-bold" key={`${cell}-${cellIndex}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <p className="border-2 border-dashed border-ink bg-paper-deep p-4 text-center font-display text-sm font-bold text-muted-foreground">
      {copy}
    </p>
  );
}

function unknownRows(items: unknown[]) {
  return items.slice(0, 20).map((item) => {
    if (!item || typeof item !== "object") return [String(item)];
    const record = item as Record<string, unknown>;
    const preferred = ["createdAt", "date", "id", "orderId", "customerLabel", "status", "commissionStatus", "amountCents", "earnedCents", "totalCents"];
    const cells = preferred
      .filter((key) => key in record)
      .map((key) => formatUnknownValue(record[key]));
    if (cells.length) return cells;
    return Object.entries(record).slice(0, 5).map(([, value]) => formatUnknownValue(value));
  });
}

function formatUnknownValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 999 ? formatMoney(value) : String(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value);
    return value;
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null) return "-";
  return JSON.stringify(value);
}
