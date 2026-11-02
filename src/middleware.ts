import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { eventDomainFor, eventDomains, site } from '@/lib/config';

// Paths an event subdomain serves itself; everything else goes to the main site.
const SHARED = /^\/(api|_next|images|icon\.svg|robots\.txt|sitemap\.xml)(\/|$)/;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const path = url.pathname;

  // ----- Event subdomain, e.g. jhumkacitymarathon.casaatleta.com -----
  const eventSlug = eventDomains[host];
  if (eventSlug) {
    if (path === '/') return NextResponse.rewrite(new URL(`/e/${eventSlug}${url.search}`, request.url));
    if (path === '/register') return NextResponse.rewrite(new URL(`/e/${eventSlug}/register${url.search}`, request.url));
    if (SHARED.test(path)) return NextResponse.next();
    return NextResponse.redirect(`${site.url}${path}${url.search}`);
  }

  // ----- Main site: send event pages to their own domain -----
  const eventPage = path.match(/^\/(?:events|e)\/([^/]+)(\/register)?\/?$/);
  if (eventPage) {
    const domain = eventDomainFor(eventPage[1]);
    if (domain) return NextResponse.redirect(`https://${domain}${eventPage[2] ?? ''}${url.search}`, 308);
  }
  if (path === '/register') {
    const domain = eventDomainFor(site.flagshipSlug);
    if (domain) return NextResponse.redirect(`https://${domain}/register${url.search}`, 308);
  }

  if (!path.startsWith('/admin') && !path.startsWith('/api/admin')) return NextResponse.next();

  // ----- Admin: keep the login session fresh -----
  let response = NextResponse.next({ request });
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supaUrl || !anon) return response;
  const supabase = createServerClient(supaUrl, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { data } = await supabase.auth.getUser();
  if (!data.user && path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const login = url.clone();
    login.pathname = '/admin/login';
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|images/|icon.svg).*)']
};
