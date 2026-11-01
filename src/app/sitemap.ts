import type { MetadataRoute } from 'next';
import { site } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', `/events/${site.flagshipSlug}`, '/register', '/about', '/contact', '/partners', '/legal/privacy', '/legal/terms', '/legal/waiver', '/legal/refunds'];
  return pages.map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'weekly', priority: p === '' || p.startsWith('/events') ? 1 : 0.6 }));
}
