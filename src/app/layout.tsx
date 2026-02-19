import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import Footer from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ChainShield — Crypto Safety Scanner',
  description:
    'Privacy-first crypto safety scanner. Paste a URL, token contract, transaction hash, or wallet address and get an instant risk assessment.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'ChainShield — Crypto Safety Scanner',
    description: 'Paste any crypto URL, token contract, transaction hash, or wallet address and get an instant risk assessment. No tracking, no cookies, no data stored.',
    type: 'website',
    siteName: 'ChainShield',
  },
  twitter: {
    card: 'summary',
    title: 'ChainShield — Crypto Safety Scanner',
    description: 'Privacy-first crypto safety scanner. Instant risk assessment for URLs, tokens, transactions, and wallets.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'ChainShield',
              description: 'Privacy-first crypto safety scanner. Instant risk assessment for URLs, tokens, transactions, and wallets.',
              applicationCategory: 'SecurityApplication',
              operatingSystem: 'Any',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              browserRequirements: 'Requires JavaScript',
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col overflow-x-hidden`}
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
