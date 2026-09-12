import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Diagram editor pages are per-user app surface (often private,
        // effectively infinite in count) — never worth crawling. API routes
        // return data, not pages.
        disallow: ['/flow/', '/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
