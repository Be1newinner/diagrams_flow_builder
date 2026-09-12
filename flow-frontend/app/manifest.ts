import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/siteConfig';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - Visual Diagram & System Design Builder`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      { src: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
