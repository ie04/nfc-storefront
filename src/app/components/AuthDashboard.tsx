"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import { loadAdminDashboard, loadPartnerPortal, login } from "@/app/lib/api";
import type { PartnerPortalData } from "@/app/lib/contracts";
import { formatDate, formatMoney } from "@/app/lib/format";

type Mode = "partner" | "admin";

export default function AuthDashboard({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("bb_account_token") || "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [partner, setPartner] = useState<PartnerPortalData | null>(null);
  const [admin, setAdmin] = useState<Awaited<ReturnType<typeof loadAdminDashboard>> | null>(null);
  const [qr, setQr] = useState("");
  const title = mode === "partner" ? "Affiliate Portal" : "NFC Admin";

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

  async function submitLogin() {
    setError("");
    try {
      const result = await login(email, password);
      window.localStorage.setItem("bb_account_token", result.token);
      setToken(result.token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
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

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <section className="bb-panel p-5">
        <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC</p>
        <h1 className="mt-2 text-4xl font-black">{title}</h1>
        {error ? <p className="mt-4 border-2 border-[var(--bb-red)] p-3 font-black text-[var(--bb-red)]">{error}</p> : null}
        {message ? <p className="mt-4 border-2 border-black bg-[var(--bb-lime)] p-3 font-black">{message}</p> : null}
        {!token ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input aria-label="Email" className="bb-input" onChange={(event) => setEmail(event.target.value)} placeholder="Email" value={email} />
            <input aria-label="Password" className="bb-input" onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" value={password} />
            <button className="bb-button bb-button-primary" onClick={() => void submitLogin()} type="button">Sign in</button>
          </div>
        ) : (
          <button className="bb-button mt-6" onClick={() => { window.localStorage.removeItem("bb_account_token"); setToken(""); setPartner(null); setAdmin(null); }} type="button">Sign out</button>
        )}
      </section>

      {mode === "partner" && partner ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="bb-panel p-5">
            <h2 className="text-2xl font-black">{partner.partner?.displayName || partner.account?.displayName || "Affiliate"}</h2>
            <p className="mt-1 font-bold text-[var(--bb-muted)]">Status: {partner.partner?.status || partner.account?.status || "pending"}</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`QR code for ${partner.referralCode}`} className="mt-4 w-full border-2 border-black" src={qr} />
            ) : null}
            <p className="mt-4 break-all border-2 border-black bg-white p-3 font-mono text-sm">{referralLink || "Referral link pending"}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button className="bb-button bb-button-primary" disabled={!referralLink} onClick={() => void copyReferral()} type="button">Copy link</button>
              <button className="bb-button" disabled={!qr} onClick={downloadQr} type="button">Download QR</button>
            </div>
          </section>
          <section className="grid gap-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Purchases" value={String(partner.metrics?.completedOrders ?? 0)} />
              <Metric label="Pending" value={formatMoney(partner.earnings?.pendingCents)} />
              <Metric label="Available" value={formatMoney(partner.earnings?.eligibleCents)} />
              <Metric label="Paid" value={formatMoney(partner.earnings?.paidCents)} />
            </div>
            <div className="bb-panel p-5">
              <h2 className="text-xl font-black">Payouts</h2>
              <p className="mt-2 font-bold text-[var(--bb-muted)]">Next request date: {nextPayoutDate}</p>
              <Table rows={(partner.payouts || []).map((item) => [formatDate(item.createdAt), formatMoney(item.amountCents), item.status])} />
            </div>
            <div className="bb-panel p-5">
              <h2 className="text-xl font-black">Commission Ledger</h2>
              <Table rows={(partner.referrals || []).map((item) => [formatDate(item.date), item.customerLabel, item.orderStatus, item.commissionStatus, formatMoney(item.earnedCents)])} />
            </div>
          </section>
        </div>
      ) : null}

      {mode === "admin" && admin ? (
        <div className="mt-6 grid gap-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="NFC orders" value={String(admin.metrics.orders)} />
            <Metric label="Paid sales" value={formatMoney(admin.metrics.paidSalesCents)} />
            <Metric label="Pending commissions" value={formatMoney(admin.metrics.pendingCommissionsCents)} />
          </div>
          <section className="bb-panel p-5">
            <h2 className="text-xl font-black">Recent Orders</h2>
            <pre className="mt-4 max-h-96 overflow-auto border-2 border-black bg-white p-4 text-xs">{JSON.stringify(admin.orders, null, 2)}</pre>
          </section>
          <section className="bb-panel p-5">
            <h2 className="text-xl font-black">Commission Queue</h2>
            <pre className="mt-4 max-h-96 overflow-auto border-2 border-black bg-white p-4 text-xs">{JSON.stringify(admin.commissionLedger, null, 2)}</pre>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bb-card bg-white p-4">
      <p className="text-xs font-black uppercase tracking-wider text-[var(--bb-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function Table({ rows }: { rows: string[][] }) {
  if (!rows.length) return <p className="mt-4 border-2 border-black bg-white p-4 font-bold">No activity yet.</p>;
  return (
    <div className="mt-4 overflow-x-auto border-2 border-black bg-white">
      <table className="w-full min-w-[620px] text-left text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t-2 border-black first:border-t-0" key={`${row.join(":")}-${index}`}>
              {row.map((cell) => <td className="p-3 font-bold" key={cell}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
