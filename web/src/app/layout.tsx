import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "open-u60-pro — ZTE U60 Pro Toolkit",
    template: "%s | open-u60-pro",
  },
  description:
    "Unlock the full potential of your ZTE U60 Pro 5G mobile router. On-device agent, native companion apps, and web-based bootstrap tools.",
  keywords: [
    "ZTE U60 Pro",
    "MU5250",
    "5G Router",
    "Band Locking",
    "Signal Monitor",
    "OpenWrt",
    "REST API",
    "WebUSB",
  ],
  authors: [{ name: "jesther-ai" }],
  openGraph: {
    title: "open-u60-pro — ZTE U60 Pro Toolkit",
    description:
      "Unlock the full potential of your ZTE U60 Pro 5G mobile router.",
    url: "https://open-u60-pro.vercel.app",
    siteName: "open-u60-pro",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "open-u60-pro — ZTE U60 Pro Toolkit",
    description:
      "Unlock the full potential of your ZTE U60 Pro 5G mobile router.",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL("https://open-u60-pro.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${jakarta.variable} ${jetbrains.variable}`}
    >
      <head>
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body className="grain-overlay">
        <Navbar />
        <main className="relative z-0 overflow-x-hidden">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
