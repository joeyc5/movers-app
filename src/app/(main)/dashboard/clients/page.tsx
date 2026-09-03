import { canWriteClients, getAccountOwnerOptions, getClients } from "@/server/queries/clients";

import { ClientsPanel } from "./_components/clients-panel";

export default async function Page() {
  const [clients, owners, canWrite] = await Promise.all([getClients(), getAccountOwnerOptions(), canWriteClients()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Clients</h1>
        <p className="text-muted-foreground text-sm">Look up a household or business account and its history.</p>
      </div>

      <ClientsPanel clients={clients} owners={owners} canWrite={canWrite} />
    </div>
  );
}
