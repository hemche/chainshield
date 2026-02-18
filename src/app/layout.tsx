import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrivacyBanner from "@/components/PrivacyBanner";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChainShield — Crypto Safety Scanner",
  description: "Privacy-first crypto safety scanner. Check URLs, token contracts, transactions, and wallet addresses for scam signals — instantly, with no tracking.",
  metadataBase: new URL("https://chainshield.app"),
  openGraph: {
    title: "ChainShield — Crypto Safety Scanner",
    description: "Paste a URL, token contract, transaction hash, or wallet address. Get an instant safety report — no tracking, no cookies, no data stored.",
    type: "website",
    siteName: "ChainShield",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChainShield — Crypto Safety Scanner",
    description: "Privacy-first crypto safety checks. Detect honeypots, phishing URLs, and malicious wallets instantly.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen flex flex-col bg-grid`}
      >
        <PrivacyBanner />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
