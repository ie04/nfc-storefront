"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { completeGoogleOAuth } from "@/app/lib/api";

export default function GoogleCallbackClient() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing Google sign-in...");

  useEffect(() => {
    let alive = true;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    async function finish() {
      try {
        if (!code || !state) throw new Error("Google did not return a complete sign-in response.");
        const callbackUrl = new URL("/auth/google/callback", window.location.origin).toString();
        const result = await completeGoogleOAuth({ callbackUrl, code, state });
        window.localStorage.setItem("bb_account_token", result.token);
        window.location.replace(result.redirectTo);
      } catch (caught) {
        if (!alive) return;
        setMessage(caught instanceof Error ? caught.message : "Unable to complete Google sign-in.");
      }
    }

    void finish();

    return () => {
      alive = false;
    };
  }, [searchParams]);

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <section className="bb-panel max-w-xl p-6 text-center">
        <p className="font-black uppercase tracking-[0.18em] text-[var(--bb-green)]">BayBlaze NFC</p>
        <h1 className="mt-2 text-3xl font-black">Google Sign-In</h1>
        <p className="mt-4 font-bold text-[var(--bb-muted)]">{message}</p>
      </section>
    </main>
  );
}
