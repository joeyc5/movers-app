import { notFound } from "next/navigation";

import { clients } from "../_components/data";
import { ClientHeader } from "./_components/client-header";
import { ClientOverview } from "./_components/client-overview";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const client = clients.find((candidate) => candidate.id === id);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <ClientHeader client={client} />
      <div className="px-4">
        <ClientOverview client={client} />
      </div>
    </div>
  );
}
