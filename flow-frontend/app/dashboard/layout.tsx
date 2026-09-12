import type { Metadata } from 'next';

// The dashboard is signed-in app surface (your diagram list), not content —
// same reasoning as /flow/[id]'s layout: keep it out of the index so it
// doesn't compete with the marketing homepage for crawl budget/ranking.
export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
