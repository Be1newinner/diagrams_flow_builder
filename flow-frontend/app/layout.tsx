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

export const metadata: Metadata = {
  title: "FlowCraft - Visual Diagram & System Design Builder",
  description: "Create beautiful system design, flowcharts, and ER diagrams with React Flow in light mode.",
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
