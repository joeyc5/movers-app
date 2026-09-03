import { notFound } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentStaff } from "@/lib/supabase/auth";
import { canWriteClients, getAccountOwnerOptions, getClientByCode } from "@/server/queries/clients";
import { getCompanyBillingProfile } from "@/server/queries/company";

import { ClientHeader } from "./_components/client-header";
import { ClientOverview } from "./_components/client-overview";
import { companyBillingProfileToInvoiceFrom } from "./_components/invoice/data";
import { Invoice } from "./_components/invoice/invoice";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const [client, billingProfile, staff, owners, canWrite] = await Promise.all([
    getClientByCode(id),
    getCompanyBillingProfile(),
    getCurrentStaff(),
    getAccountOwnerOptions(),
    canWriteClients(),
  ]);

  if (!client) {
    notFound();
  }

  const invoiceFrom = companyBillingProfileToInvoiceFrom(billingProfile, staff?.full_name ?? "");

  return (
    <div className="flex flex-col gap-4">
      <ClientHeader client={client} owners={owners} canWrite={canWrite} />

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
          <Invoice client={client} from={invoiceFrom} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
