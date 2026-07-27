"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BayBlazeSignOnElement, type AuthFormState, type AuthMode } from "@/app/components/AuthDashboard";
import { claimPartnerClaimCode, getPartnerClaimCode, loginCustomer, registerCustomer, type PartnerClaimCode } from "@/app/lib/api";

export default function ClaimCodePage({ code }: { code: string }) {
  const [claimCode, setClaimCode] = useState<PartnerClaimCode | null>(null);
  const [token, setToken] = useState(() => typeof window === "undefined" ? "" : window.localStorage.getItem("bb_account_token") || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(() => code ? "" : "This flyer link is missing its claim code.");
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }
    getPartnerClaimCode(code)
      .then((result) => {
        setClaimCode(result.claimCode);
        if (result.claimCode.status === "claimed") {
          window.location.replace(result.claimCode.referralUrl || `/?ref=${encodeURIComponent(result.claimCode.code)}`);
        }
      })
      .catch((caught: Error) => setError(caught.message));
  }, [code]);

  async function submitAuth(input: AuthFormState & { authMode: AuthMode }) {
    const result = input.authMode === "register"
      ? await registerCustomer({
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          password: input.password,
        })
      : await loginCustomer(input.email, input.password);
    window.localStorage.setItem("bb_account_token", result.token);
    setToken(result.token);
    await claimWithToken(result.token);
  }

  async function claimWithToken(nextToken = token) {
    if (!claimCode || !nextToken) return;
    setError("");
    setMessage("");
    try {
      const result = await claimPartnerClaimCode(claimCode.code, nextToken);
      setClaimCode(result.claimCode);
      setClaimed(true);
      setMessage(`You claimed affiliate code ${result.claimCode.code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not claim this affiliate QR.");
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-5xl place-items-center px-4 py-8">
      <section className="bb-panel w-full p-5 sm:p-8">
        <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC Affiliates</p>
        <h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl">Claim your flyer QR.</h1>
        <p className="mt-4 max-w-2xl text-lg font-semibold text-[var(--bb-muted)]">
          Sign in or create your BayBlaze account, and this printed QR code becomes your affiliate link.
        </p>

        {claimCode ? (
          <div className="mt-5 border-2 border-black bg-[var(--bb-sky)] p-4">
            <p className="text-sm font-black uppercase tracking-wider">Flyer code</p>
            <p className="mt-1 font-mono text-2xl font-black">{claimCode.code}</p>
          </div>
        ) : null}

        {message ? <p className="mt-4 border-2 border-black bg-[var(--bb-lime)] p-3 font-black">{message}</p> : null}
        {error ? <p className="mt-4 border-2 border-[var(--bb-red)] bg-white p-3 font-black text-[var(--bb-red)]">{error}</p> : null}

        {claimed && claimCode ? (
          <div className="mt-6 grid gap-3">
            <p className="font-bold">Your QR is ready. Anyone who scans this flyer now goes through your affiliate referral.</p>
            <Link className="bb-button bb-button-primary w-fit" href={`/?ref=${encodeURIComponent(claimCode.code)}`}>Open my referral page</Link>
          </div>
        ) : token && claimCode?.status === "unclaimed" ? (
          <button className="bb-button bb-button-primary mt-6" onClick={() => void claimWithToken()} type="button">Claim this QR code</button>
        ) : claimCode?.status === "unclaimed" ? (
          <BayBlazeSignOnElement
            allowRegister
            heading="Sign In"
            onSubmit={submitAuth}
            submitError={error}
          />
        ) : null}
      </section>
    </main>
  );
}
