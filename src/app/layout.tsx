import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  description: "Configure and order BayBlaze NFC tags.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nfc.bayblaze.net"),
  title: "BayBlaze NFC Tags",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
