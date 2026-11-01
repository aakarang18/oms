import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { site } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: 'Casa Atleta — Running events in Bareilly | Jhumka City Run',
    template: '%s | Casa Atleta'
  },
  description:
    'Casa Atleta organises running and endurance events in Bareilly, Uttar Pradesh. Register for Jhumka City Run — 5K, 10K, 21K half marathon and Kids Run.',
  keywords: ['running events in Bareilly', '5K run Bareilly', '10K run Bareilly', 'half marathon Bareilly', '21K run Bareilly', 'marathon Bareilly', 'running events in Uttar Pradesh', 'Jhumka City Run'],
  openGraph: {
    type: 'website',
    siteName: 'Casa Atleta',
    locale: 'en_IN',
    images: [{ url: '/images/band.jpg', width: 1800, height: 1012, alt: 'Runners on a city street' }]
  },
  twitter: { card: 'summary_large_image' }
};

export const viewport: Viewport = { themeColor: '#1E5B49', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ga = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body>
        {children}
        {ga && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
      </body>
    </html>
  );
}
