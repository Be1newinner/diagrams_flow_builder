import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

// Only static, publicly-indexable marketing/docs routes belong here.
// /flow/[id] editor pages are per-user (often private) app surface, not
// content — they're excluded and marked noindex in their own layout instead
// of being listed for crawling.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/mcp-config`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
