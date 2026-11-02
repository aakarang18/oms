import { EventContent, eventMetadata } from '@/components/EventContent';

// Used when an event has no domain of its own. With NEXT_PUBLIC_EVENT_DOMAINS set,
// visitors are redirected to the event's own site (see middleware.ts).
export const revalidate = 60;

export function generateMetadata({ params }: { params: { slug: string } }) {
  return eventMetadata(params.slug);
}

export default function EventPage({ params }: { params: { slug: string } }) {
  return <EventContent slug={params.slug} />;
}
