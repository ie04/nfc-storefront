"use client";

import QRCode from "qrcode";
import { usePathname, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { createPartnerClaimCode, loadAdminDashboard, loadPartnerPortal, login, loginCustomer, registerCustomer } from "@/app/lib/api";
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
  const [claimQr, setClaimQr] = useState("");
  const [claimUrl, setClaimUrl] = useState("");
  const [claimCode, setClaimCode] = useState("");
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

  async function generateClaimCode() {
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const result = await createPartnerClaimCode(token);
      setClaimCode(result.claimCode.code);
      setClaimUrl(result.claimCode.claimUrl);
      setClaimQr(await QRCode.toDataURL(result.claimCode.claimUrl, { errorCorrectionLevel: "H", margin: 1, width: 720 }));
      setMessage(`Claim QR ${result.claimCode.code} is ready to print.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a claim QR.");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <section className="bb-panel p-5">
        <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC</p>
        <h1 className="mt-2 text-4xl font-black">{title}</h1>
        {error ? <p className="mt-4 border-2 border-[var(--bb-red)] p-3 font-black text-[var(--bb-red)]">{error}</p> : null}
        {message ? <p className="mt-4 border-2 border-black bg-[var(--bb-lime)] p-3 font-black">{message}</p> : null}
        {!token ? (
          <BayBlazeSignOnElement
            allowRegister={mode === "partner"}
            heading={mode === "partner" ? "Sign In" : "Admin Sign In"}
            onSubmit={submitAuth}
            submitError={error}
          />
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
            <h2 className="text-xl font-black">Flyer Claim QR</h2>
            <p className="mt-2 text-sm font-bold text-[var(--bb-muted)]">Print this QR on a flyer before the affiliate has an account. When they scan it, they can sign in or register and claim the code.</p>
            <button className="bb-button bb-button-primary mt-4" onClick={() => void generateClaimCode()} type="button">Create claim QR</button>
            {claimQr ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={`Claim QR code ${claimCode}`} className="w-full border-2 border-black bg-white" src={claimQr} />
                <div>
                  <p className="font-black">Code: {claimCode}</p>
                  <p className="mt-2 break-all border-2 border-black bg-white p-3 font-mono text-xs">{claimUrl}</p>
                  <button className="bb-button mt-3" onClick={() => { const anchor = document.createElement("a"); anchor.download = `bayblaze-claim-${claimCode.toLowerCase()}-qr.png`; anchor.href = claimQr; anchor.click(); }} type="button">Download QR</button>
                </div>
              </div>
            ) : null}
          </section>
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
}: {
  allowRegister: boolean;
  heading: string;
  onSubmit: (input: AuthFormState & { authMode: AuthMode }) => Promise<void>;
  submitError: string;
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
      className="mx-auto mt-6 w-full max-w-[520px] border-2 border-black bg-white p-5 shadow-[6px_6px_0_#000] sm:p-8"
    >
      <h2
        className="mb-6 text-center text-4xl font-black uppercase leading-none text-black sm:text-5xl"
        id="bayblaze-auth-heading"
      >
        {heading}
      </h2>

      {allowRegister ? (
        <div className="mb-6 grid grid-cols-2 border-2 border-black bg-white">
          <button
            aria-pressed={authMode === "login"}
            className={`h-12 border-r-2 border-black text-[14px] font-extrabold uppercase tracking-widest transition-colors ${
              authMode === "login" ? "bg-black text-white" : "bg-white text-black hover:bg-[var(--bb-lime)]"
            }`}
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
            className={`h-12 text-[14px] font-extrabold uppercase tracking-widest transition-colors ${
              authMode === "register" ? "bg-black text-white" : "bg-white text-black hover:bg-[var(--bb-lime)]"
            }`}
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
        className="mb-5 flex h-12 w-full items-center justify-center gap-3 border-2 border-black bg-white px-4 text-center text-[14px] font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-black hover:text-white"
        href={googleHref}
      >
        <span aria-hidden="true" className="grid size-5 place-items-center border-2 border-black bg-white text-[12px] font-black leading-none text-black">G</span>
        Continue with Google
      </a>

      <div className="mb-5 flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-[0.16em] text-[var(--bb-muted)]">
        <span className="h-0.5 flex-1 bg-black" />
        <span>Email</span>
        <span className="h-0.5 flex-1 bg-black" />
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

        <p aria-live="polite" className="min-h-6 border-2 border-transparent text-[14px] font-bold text-[var(--bb-red)]">
          {localError || submitError}
        </p>

        <button
          className="bb-button bb-button-primary flex h-[52px] w-full"
          disabled={isSubmitting}
          type="submit"
        >
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
    <label className="block text-[13px] font-extrabold uppercase tracking-widest text-black">
      {label}
      <input
        autoComplete={autoComplete}
        className="bb-input mt-2 h-12 text-[16px] font-medium normal-case tracking-normal"
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
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
