import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { NewsletterPopup, NotifyButton } from '@/components/NewsletterPopup';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <div className="topbar">
        Jhumka City Run · registrations opening soon —{' '}
        <NotifyButton style={{ border: 0, background: 'none', padding: 0, fontWeight: 800, textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}>get notified</NotifyButton>
      </div>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <NewsletterPopup />
    </>
  );
}
