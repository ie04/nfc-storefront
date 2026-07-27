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
          window.location.replace("/partners");
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
      window.location.replace("/partners");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not claim this affiliate QR.");
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden border-b-2 border-ink bg-sky px-5 py-8 sm:px-10 sm:py-12 lg:min-h-screen lg:border-b-0 lg:border-r-2">
          <div className="relative z-10">
            <p className="eyebrow text-emerald">BayBlaze NFC Affiliates</p>
            <h1 className="mt-5 max-w-xl text-[44px] leading-[0.95] sm:text-6xl lg:text-7xl">
              Claim your flyer <span className="block sm:inline">QR.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg font-medium leading-relaxed text-muted-foreground sm:text-xl">
              Sign in or create your BayBlaze account, and this printed QR code becomes your affiliate link.
            </p>
          </div>

          <div className="relative z-10 mt-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end lg:block">
            {claimCode ? (
              <div className="panel offset-sm w-full max-w-md bg-card p-5">
                <p className="eyebrow">Flyer code</p>
                <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{claimCode.code}</p>
              </div>
            ) : (
              <div className="panel offset-sm w-full max-w-md bg-card p-5">
                <p className="eyebrow">Flyer code</p>
                <p className="mt-2 font-display text-xl font-bold">Checking link...</p>
              </div>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="3D printed green NFC keychain tag with a custom star design"
              className="h-32 w-32 justify-self-center object-contain drop-shadow-[8px_10px_0_rgba(0,0,0,0.18)] sm:h-44 sm:w-44 sm:justify-self-end lg:mt-10 lg:h-56 lg:w-56"
              height={816}
              src="/assets/tag-custom.png"
              width={816}
            />
          </div>
        </div>

        <div className="flex min-h-[58vh] items-center justify-center px-5 py-8 sm:px-10 sm:py-12 lg:min-h-screen">
          <div className="w-full max-w-[760px]">
            {message ? <p className="panel offset-sm mb-5 bg-sky p-4 font-display text-sm font-bold">{message}</p> : null}
            {error && (!claimCode || claimCode.status !== "unclaimed") ? (
              <p className="panel offset-sm mb-5 break-all border-destructive bg-card p-4 font-display text-sm font-bold text-destructive">{error}</p>
            ) : null}

            {claimed && claimCode ? (
              <div className="panel offset bg-card p-6 sm:p-8">
                <p className="eyebrow text-emerald">Ready</p>
                <h2 className="mt-3 text-4xl leading-none sm:text-5xl">Your QR is claimed.</h2>
                <p className="mt-4 max-w-xl text-lg font-medium text-muted-foreground">
                  Anyone who scans this flyer now goes through your affiliate referral.
                </p>
                <Link className="bb-button bb-button-primary offset-sm mt-6 w-fit hover:-translate-x-[2px] hover:-translate-y-[2px]" href="/partners">Open affiliate portal</Link>
              </div>
            ) : token && claimCode?.status === "unclaimed" ? (
              <div className="panel offset bg-card p-6 sm:p-8">
                <p className="eyebrow text-emerald">Almost done</p>
                <h2 className="mt-3 text-4xl leading-none sm:text-5xl">Claim this QR code.</h2>
                <p className="mt-4 max-w-xl text-lg font-medium text-muted-foreground">
                  Attach this flyer code to your BayBlaze account.
                </p>
                <button className="bb-button bb-button-primary offset-sm mt-6 hover:-translate-x-[2px] hover:-translate-y-[2px]" onClick={() => void claimWithToken()} type="button">Claim this QR code</button>
              </div>
            ) : claimCode?.status === "unclaimed" ? (
              <BayBlazeSignOnElement
                allowRegister
                heading="Sign in"
                onSubmit={submitAuth}
                submitError={error}
                width="wide"
              />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
