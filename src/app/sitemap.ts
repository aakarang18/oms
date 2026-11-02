import type { MetadataRoute } from 'next';
import { eventDomainFor, site } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/about', '/contact', '/partners', '/legal/privacy', '/legal/terms', '/legal/waiver', '/legal/refunds'];
  const domain = eventDomainFor(site.flagshipSlug);
  const event = domain ? `https://${domain}` : `${site.url}/events/${site.flagshipSlug}`;
  return [
    { url: event, changeFrequency: 'weekly', priority: 1 },
    ...pages.map((p) => ({ url: `${site.url}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 }))
  ];
}
