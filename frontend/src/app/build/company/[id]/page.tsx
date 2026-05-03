import { redirect } from "next/navigation";

export default async function CompanyRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/build/employer/${encodeURIComponent(id)}`);
}
