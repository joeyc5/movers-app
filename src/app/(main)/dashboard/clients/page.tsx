import { ClientsPanel } from "./_components/clients-panel";
import { clients } from "./_components/data";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Clients</h1>
        <p className="text-muted-foreground text-sm">Look up a household or business account and its history.</p>
      </div>

      <ClientsPanel clients={clients} />
    </div>
  );
}
