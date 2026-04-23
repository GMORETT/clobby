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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://clobby.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Clobby — the lobby for people waiting on agents",
    template: "%s · Clobby",
  },
  description:
    "While your AI codes, hang out with other devs doing the same. See who's heads-down, who's stuck, who's idle.",
  applicationName: "Clobby",
  keywords: [
    "claude code",
    "claude desktop",
    "cursor",
    "ai pair programming",
    "agent status",
    "dev community",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Clobby",
    title: "Clobby — the lobby for people waiting on agents",
    description:
      "While your AI codes, hang out with other devs doing the same.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clobby — the lobby for people waiting on agents",
    description:
      "While your AI codes, hang out with other devs doing the same.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
