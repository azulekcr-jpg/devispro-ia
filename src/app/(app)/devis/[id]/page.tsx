'use client';
import { useParams } from 'next/navigation';
import QuoteEditor from '@/components/QuoteEditor';

export default function ModifierDevis() {
  const { id } = useParams<{ id: string }>();
  return <QuoteEditor key={id} id={id} />;
}
