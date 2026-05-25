import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const BASE_URL = "https://luminasummarizer.com";

export const metadata: Metadata = {
  title: {
    default: "Lumina — AI PDF Summarizer",
    template: "%s | Lumina",
  },
  description:
    "Upload a PDF and get an AI-generated summary, Q&A with cited answers, quizzes, and flashcards in seconds.",
  metadataBase: new URL(BASE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Lumina — AI PDF Summarizer",
    description:
      "Upload a PDF and get an AI-generated summary, Q&A with cited answers, quizzes, and flashcards in seconds.",
    url: BASE_URL,
    siteName: "Lumina",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Lumina — AI PDF Summarizer" }],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumina — AI PDF Summarizer",
    description:
      "Upload a PDF and get an AI-generated summary, Q&A with cited answers, quizzes, and flashcards in seconds.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
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
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Lumina",
              url: BASE_URL,
              description: "AI-powered PDF study tools",
              applicationCategory: "EducationApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
        {children}
        <Toaster position="top-center" richColors />
        <Script
          src="https://datafa.st/js/script.js"
          data-website-id="dfid_Gw5tBYCYIyGabLRdxyslq"
          data-domain="luminasummarizer.com"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
