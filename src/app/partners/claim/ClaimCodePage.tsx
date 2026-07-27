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
    <main className="min-h-screen bg-background px-5 py-10 sm:py-14">
      <section className="panel offset mx-auto w-full max-w-5xl overflow-hidden">
        <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="eyebrow text-emerald">BayBlaze NFC Affiliates</p>
            <h1 className="mt-5 text-5xl leading-[0.95] sm:text-6xl">Claim your flyer QR.</h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
              Sign in or create your BayBlaze account, and this printed QR code becomes your affiliate link.
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="3D printed green NFC keychain tag with a custom star design"
            className="hidden h-40 w-40 object-contain drop-shadow-[8px_10px_0_rgba(0,0,0,0.18)] lg:block"
            height={816}
            src="/assets/tag-custom.png"
            width={816}
          />
        </div>

        {claimCode ? (
          <div className="border-t-2 border-ink bg-sky p-6 sm:px-12">
            <p className="eyebrow">Flyer code</p>
            <p className="mt-1 font-mono text-2xl font-bold">{claimCode.code}</p>
          </div>
        ) : null}

        <div className="p-8 sm:p-12">
          {message ? <p className="panel offset-sm mb-4 bg-sky p-4 font-display text-sm font-bold">{message}</p> : null}
          {error ? <p className="panel offset-sm mb-4 border-destructive bg-card p-4 font-display text-sm font-bold text-destructive">{error}</p> : null}

          {claimed && claimCode ? (
            <div className="grid gap-4">
              <p className="font-display text-lg font-bold">Your QR is ready. Anyone who scans this flyer now goes through your affiliate referral.</p>
              <Link className="bb-button bb-button-primary offset-sm w-fit hover:-translate-x-[2px] hover:-translate-y-[2px]" href={`/?ref=${encodeURIComponent(claimCode.code)}`}>Open my referral page</Link>
            </div>
          ) : token && claimCode?.status === "unclaimed" ? (
            <button className="bb-button bb-button-primary offset-sm hover:-translate-x-[2px] hover:-translate-y-[2px]" onClick={() => void claimWithToken()} type="button">Claim this QR code</button>
          ) : claimCode?.status === "unclaimed" ? (
            <BayBlazeSignOnElement
              allowRegister
              heading="Sign in"
              onSubmit={submitAuth}
              submitError={error}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
