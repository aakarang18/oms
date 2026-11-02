import { EventContent, eventMetadata } from '@/components/EventContent';

// Home page of an event's own website, e.g. jhumkacitymarathon.casaatleta.com
export const revalidate = 60;

export function generateMetadata({ params }: { params: { slug: string } }) {
  return eventMetadata(params.slug);
}

export default function EventHome({ params }: { params: { slug: string } }) {
  return <EventContent slug={params.slug} ownDomain />;
}
