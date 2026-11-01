import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { site } from '@/lib/config';

/*
 * IMPORTANT: These are starting drafts only. Have them reviewed by a lawyer
 * and replace the text below before registrations open.
 */
const PAGES: Record<string, { title: string; body: string[] }> = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'Casa Atleta (“we”) collects only the information needed to run our events: your name, date of birth, gender, contact details, city, emergency contact, T-shirt size and, if you choose to share it, medical information and running club.',
      'We use this information to process your registration and payment, contact you about the event, keep you safe on race day, and publish results if timing is used. Payments are handled by our payment partner (Razorpay); we never see or store your card details.',
      'Medical information is shared only with the race-day medical team and is deleted after the event. We do not sell your data. Marketing emails and WhatsApp messages are sent only if you opt in, and you can unsubscribe at any time.',
      'Your data is stored securely with our hosting and database providers. You can ask us to see, correct or delete your data by contacting us.',
      '[To be reviewed by a lawyer before launch — add data retention periods, grievance officer details and any DPDP Act 2023 requirements.]'
    ]
  },
  terms: {
    title: 'Event Terms & Conditions',
    body: [
      'By registering for a Casa Atleta event you agree to follow the race rules, instructions from marshals and officials, and the participant guidelines published on the event page.',
      'Your bib is personal to you and may not be transferred or sold except as allowed in our transfer policy. Participants must meet the age requirements for their race on race day.',
      'The organisers may change the route, schedule or format for safety or permission reasons. Details that are not yet confirmed are shown as “To be announced”.',
      '[To be reviewed by a lawyer before launch.]'
    ]
  },
  waiver: {
    title: 'Participant Waiver & Declaration',
    body: [
      'I confirm that I (or the child I am registering) am medically fit to take part and have trained appropriately for the chosen distance.',
      'I understand that running involves physical exertion and risk of injury, and I take part voluntarily. I will follow all safety instructions and seek medical help if I feel unwell.',
      'I agree that the organisers, partners and volunteers are not responsible for loss of personal belongings, and I consent to receiving first aid or medical treatment if needed during the event.',
      '[To be reviewed by a lawyer before launch.]'
    ]
  },
  refunds: {
    title: 'Cancellation, Transfer & Refund Policy',
    body: [
      'Cancellation, transfer and refund terms for each event will be published here before registrations open.',
      'If an event is postponed, your registration will move to the new date. If it is cancelled by the organisers, we will explain the refund or credit options by email.',
      'Failed or duplicate payments are refunded automatically by our payment partner, usually within 5–7 working days.',
      '[Organisers: add your final policy before opening registrations.]'
    ]
  }
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: PAGES[params.slug]?.title ?? 'Legal' };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const page = PAGES[params.slug];
  if (!page) notFound();
  return (
    <section className="wrap" style={{ paddingTop: 64, maxWidth: 860 }}>
      <h1 className="d h-md forest">{page.title}</h1>
      <div className="card" style={{ padding: 'clamp(22px,4vw,44px)', marginTop: 24, fontSize: 17, lineHeight: 1.75 }}>
        {page.body.map((p, i) => <p key={i} style={{ margin: i ? '16px 0 0' : 0 }}>{p}</p>)}
        <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>Questions? Contact us{site.email ? ` at ${site.email}` : ''}.</p>
      </div>
    </section>
  );
}
