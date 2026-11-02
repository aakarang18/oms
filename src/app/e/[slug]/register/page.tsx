import type { Metadata } from 'next';
import { RegisterContent } from '@/components/RegisterContent';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Register', robots: { index: false } };

export default function EventRegister({ params, searchParams }: { params: { slug: string }; searchParams: { race?: string } }) {
  return <RegisterContent slug={params.slug} race={searchParams.race} />;
}
