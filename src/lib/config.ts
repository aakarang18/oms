export const site = {
  name: 'Casa Atleta',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE || '',
  city: 'Bareilly, Uttar Pradesh',
  flagshipSlug: 'jhumka-city-run'
};

export function whatsappLink(text?: string) {
  const digits = site.whatsapp.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function instagramLink() {
  return site.instagram ? `https://instagram.com/${site.instagram.replace(/^@/, '')}` : null;
}
