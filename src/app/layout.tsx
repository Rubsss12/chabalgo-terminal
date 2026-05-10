import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChabAlgo Terminal — Institutional research, built for everyone",
  description:
    "A free Bloomberg-style terminal for serious investors. Live stock + crypto data, AI bottleneck explorer, 13F tracker, sector deep dives, Reddit sentiment — all in one place.",
  keywords: [
    "stock terminal",
    "Bloomberg alternative",
    "AI stocks",
    "stock analysis",
    "crypto terminal",
    "13F filings",
    "sector analysis",
    "ChabAlgo",
  ],
  openGraph: {
    title: "ChabAlgo Terminal",
    description:
      "Live stocks, crypto, AI bottlenecks, 13F tracker, sector deep dives. Free.",
    type: "website",
    url: "https://chabalgo-terminal.vercel.app",
    siteName: "ChabAlgo Terminal",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChabAlgo Terminal",
    description:
      "Live stocks, crypto, AI bottlenecks, 13F tracker, sector deep dives. Free.",
  },
  themeColor: "#F37021",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
