import { notFound } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClientByCode } from "@/server/queries/clients";

import { ClientHeader } from "./_components/client-header";
import { ClientOverview } from "./_components/client-overview";
import { Invoice } from "./_components/invoice/invoice";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const client = await getClientByCode(id);

  if (!client) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <ClientHeader client={client} />

      <Tabs className="min-h-0 flex-1 gap-0" defaultValue="overview">
        <div className="scrollbar-none touch-pan-x overflow-x-auto overscroll-x-contain border-y">
          <TabsList
            className="w-max min-w-full justify-start gap-4 px-4 *:data-[slot=tabs-trigger]:flex-none"
            variant="line"
          >
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent className="px-4 py-4" value="overview">
          <ClientOverview client={client} />
        </TabsContent>

        <TabsContent className="px-4 py-4" value="invoices">
          <Invoice client={client} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
