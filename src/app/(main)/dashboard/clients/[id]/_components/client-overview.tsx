import { format } from "date-fns";

import { Separator } from "@/components/ui/separator";

import { type Client, formatAddress } from "../../_components/data";

interface ClientOverviewProps {
  client: Client;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export function ClientOverview({ client }: ClientOverviewProps) {
  return (
    <>
      {client.notes ? (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="font-heading font-medium text-base">Notes</h2>
            <p className="text-muted-foreground text-sm">{client.notes}</p>
          </div>
          <Separator className="my-4" />
        </>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="font-heading font-medium text-base">Contact & account</h2>
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 xl:gap-12">
          <div className="flex flex-col gap-5">
            <Field label="Primary contact" value={client.primaryContactName} />
            <Field label="Email" value={client.email} />
            <Field label="Phone" value={client.phone} />
          </div>

          <div className="flex flex-col gap-5">
            <Field label="Account owner" value={client.accountOwner} />
            <Field label="Type" value={client.type} />
            <Field label="Status" value={client.status} />
          </div>

          <div className="flex flex-col gap-5">
            <Field label="Client since" value={format(new Date(client.createdDate), "MMM d, yyyy")} />
            <Field label="Last activity" value={format(new Date(client.lastActivityDate), "MMM d, yyyy")} />
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <h2 className="font-heading font-medium text-base">Addresses</h2>
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 xl:gap-12">
          <Field label="Billing" value={formatAddress(client.billingAddress) ?? "—"} />
          {client.originAddress ? <Field label="Origin" value={formatAddress(client.originAddress) ?? "—"} /> : null}
          {client.destinationAddress ? (
            <Field label="Destination" value={formatAddress(client.destinationAddress) ?? "—"} />
          ) : null}
        </div>
      </div>
    </>
  );
}
