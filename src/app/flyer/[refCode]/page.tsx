import type { Metadata } from "next";

import { NfcReferralFlyer } from "@/components/flyers/NfcReferralFlyer";

export const metadata: Metadata = {
  description: "Print-ready BayBlaze flyer with a personalized NFC referral QR code.",
  title: "BayBlaze Custom NFC Tags - Referral Flyer",
};

export default async function FlyerPage({ params }: { params: Promise<{ refCode: string }> }) {
  const { refCode } = await params;
  return <NfcReferralFlyer refCode={refCode} />;
}
