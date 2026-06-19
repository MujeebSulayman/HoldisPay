import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://holdispay.xyz'),
  title: {
    default: "HoldisPay - Invoices, contracts & payments held in one place",
    template: "%s | HoldisPay"
  },
  description: "Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, and non-custodial on-chain payments.",
  keywords: ["invoicing", "smart contract escrow", "on-chain payments", "web3 payments", "freelance payments", "crypto invoicing"],
  authors: [{ name: "HoldisPay Team" }],
  creator: "HoldisPay",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://holdispay.xyz",
    siteName: "HoldisPay",
    title: "HoldisPay - Invoices, contracts & payments held in one place",
    description: "Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, on-chain.",
    images: [
      {
        url: "https://holdispay.xyz/logo.png",
        width: 1200,
        height: 630,
        alt: "HoldisPay",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HoldisPay - Invoices, contracts & payments held in one place",
    description: "Create invoices, lock funds in escrow, and release payment when work is done. Simple, secure, on-chain.",
    images: ["https://holdispay.xyz/logo.png"],
    creator: "@holdispay",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "https://holdispay.xyz",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${sora.variable}`}>
      <body className="font-sans text-base antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
