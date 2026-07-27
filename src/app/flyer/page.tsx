import type { Metadata } from "next";

import { NfcReferralFlyer } from "@/components/flyers/NfcReferralFlyer";

export const metadata: Metadata = {
  description: "Print-ready BayBlaze flyer for custom 3D-printed NFC tags.",
  title: "BayBlaze Custom NFC Tags - Print Flyer",
};

export default function BlankFlyerPage() {
  return <NfcReferralFlyer />;
}
