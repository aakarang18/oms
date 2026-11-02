export const site = {
  name: 'Casa Atleta',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || '',
  city: 'Bareilly, Uttar Pradesh',
  flagshipSlug: 'jhumka-city-run'
};

/*
 * Event websites on their own (sub)domains, like a race's own site under the
 * company site. Format: "domain=event-slug", comma-separated, e.g.
 *   NEXT_PUBLIC_EVENT_DOMAINS=jhumkacitymarathon.casaatleta.com=jhumka-city-run
 * When empty (local development, previews), events live at /events/<slug>.
 */
export const eventDomains: Record<string, string> = Object.fromEntries(
  (process.env.NEXT_PUBLIC_EVENT_DOMAINS || '')
    .split(',')
    .map((pair) => pair.trim().split('='))
    .filter((p) => p.length === 2 && p[0] && p[1])
    .map(([domain, slug]) => [domain.trim().toLowerCase(), slug.trim()])
);

export function eventDomainFor(slug: string) {
  return Object.keys(eventDomains).find((d) => eventDomains[d] === slug) ?? null;
}

/** Link to an event page or its registration — on the event's own domain when it has one. */
export function eventHref(path: '/' | '/register' | string = '/', slug = site.flagshipSlug) {
  const domain = eventDomainFor(slug);
  if (domain) return `https://${domain}${path === '/' ? '' : path}`;
  if (path === '/' || path.startsWith('#')) return `/events/${slug}${path === '/' ? '' : path}`;
  return path;
}

/** Link to a page of the main company site (absolute when viewed from an event domain). */
export function mainHref(path: string) {
  return `${site.url}${path}`;
}

export function whatsappLink(text?: string) {
  const digits = site.whatsapp.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function instagramLink() {
  return site.instagram ? `https://instagram.com/${site.instagram.replace(/^@/, '')}` : null;
}
