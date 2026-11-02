import type { Metadata } from 'next';
import { RegisterContent } from '@/components/RegisterContent';
import { site } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Register — Jhumka City Run', robots: { index: false } };

export default function RegisterPage({ searchParams }: { searchParams: { race?: string } }) {
  return <RegisterContent slug={site.flagshipSlug} race={searchParams.race} />;
}
