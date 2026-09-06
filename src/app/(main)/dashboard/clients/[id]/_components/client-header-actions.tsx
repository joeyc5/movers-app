"use client";

import { useTransition } from "react";

import { Check, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setClientStatus } from "@/server/client-actions";
import type { AccountOwnerOption } from "@/server/queries/clients";

import { ClientFormSheet } from "../../_components/client-form-sheet";
import type { Client, ClientStatus } from "../../_components/data";

const STATUSES: ClientStatus[] = ["Lead", "Active", "In Storage", "Past", "Inactive"];

interface ClientHeaderActionsProps {
  client: Client;
  owners: AccountOwnerOption[];
  canWrite: boolean;
}

export function ClientHeaderActions({ client, owners, canWrite }: ClientHeaderActionsProps) {
  const [pending, startTransition] = useTransition();

  function changeStatus(status: ClientStatus) {
    if (status === client.status) return;
    startTransition(async () => {
      const result = await setClientStatus(client.id, status);
      if (result?.error) toast.error(result.error);
      else toast.success(`Status set to ${status}.`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <a href={`mailto:${client.email}`}>
          <Mail data-icon="inline-start" />
          Email
        </a>
      </Button>

      {canWrite && (
        <>
          <ClientFormSheet
            mode="edit"
            client={client}
            owners={owners}
            trigger={
              <Button size="sm">
                <Pencil data-icon="inline-start" />
                Edit details
              </Button>
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={pending}>
                Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Set status</DropdownMenuLabel>
              {STATUSES.map((status) => (
                <DropdownMenuItem key={status} onSelect={() => changeStatus(status)}>
                  {status}
                  {status === client.status ? <Check className="ml-auto size-4" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
