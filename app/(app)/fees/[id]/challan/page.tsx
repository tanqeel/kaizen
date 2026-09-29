import { redirect } from 'next/navigation';

/** Legacy route — now served by the unified KAIZEN print design system. */
export default async function FeeChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/print/fee-voucher/${id}`);
}
