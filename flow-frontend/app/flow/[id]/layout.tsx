import type { Metadata } from 'next';

// Diagram editor pages are per-user app surface — often private, and even
// public ones are shared links rather than content meant to rank — so they
// stay out of the index entirely rather than competing with the marketing
// pages for crawl budget.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
