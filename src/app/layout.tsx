import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  description: "Order a custom NFC tag in three steps: pick a tag style, set the website or social profile it opens, and choose local delivery or USPS shipping.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nfc.bayblaze.net"),
  openGraph: {
    description: "Order a custom NFC tag in three steps: pick a tag style, set the website or social profile it opens, and choose local delivery or USPS shipping.",
    title: "BayBlaze NFC - Custom NFC tags that point people where you want",
    type: "website",
  },
  title: "BayBlaze NFC - Custom NFC tags that point people where you want",
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
