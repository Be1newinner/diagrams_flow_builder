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

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthModal } from "@/components/auth/AuthModal";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_KEYWORDS } from "@/lib/siteConfig";

const TITLE = "FlowCraft - Visual Diagram & System Design Builder";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: "Shipsar Developers", url: "https://www.shipsar.in" }],
  creator: "Shipsar Developers",
  publisher: "Shipsar Developers",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/dashboard_screenshot.png",
        width: 1200,
        height: 630,
        alt: "FlowCraft diagram editor showing a system design canvas",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: ["/dashboard_screenshot.png"],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
      { url: '/logo-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
};

// SoftwareApplication structured data so Google can render a rich result
// (name, description, category, price) instead of a plain blue link — kept
// here rather than per-page since the whole app is one "product" for
// crawlers, regardless of which client route they land on.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
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
      suppressHydrationWarning
    >
      {/* Background/foreground come from the CSS vars in globals.css (swapped
          by ThemeContext toggling the .dark class on this element), not
          Tailwind utility classes here — a class like bg-slate-50 would win
          specificity over the var-driven `body { background: ... }` rule and
          silently defeat dark mode. suppressHydrationWarning is needed
          because ThemeContext sets the .dark class imperceptibly after
          mount, outside React's own hydration diffing. */}
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- static, server-authored JSON, not user input
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider>
          <AuthProvider>
            {children}
            <AuthModal />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
