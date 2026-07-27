import type { Metadata } from "next";

import { NfcReferralFlyer } from "@/components/flyers/NfcReferralFlyer";

export const metadata: Metadata = {
  description: "Print-ready BayBlaze flyer with an unclaimed affiliate QR code.",
  title: "BayBlaze Custom NFC Tags - Claim Flyer",
};

export default async function ClaimFlyerPage({ params }: { params: Promise<{ refCode: string }> }) {
  const { refCode } = await params;
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://nfc.bayblaze.net").replace(/\/+$/, "");
  const qrUrl = `${baseUrl}/partners/claim?code=${encodeURIComponent(refCode)}`;

  return (
    <NfcReferralFlyer
      qrTitle={`BayBlaze NFC affiliate claim QR for ${refCode}`}
      qrUrl={qrUrl}
      refCode={refCode}
      scanLabel="Scan to Get Your Own Custom Tag!"
      scanLabelVariant="loud"
    />
  );
}
