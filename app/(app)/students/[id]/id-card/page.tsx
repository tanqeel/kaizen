import { redirect } from 'next/navigation';

/** Legacy route — now served by the unified KAIZEN print design system. */
export default async function StudentIdCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/print/id-card/${id}`);
}
