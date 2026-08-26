import { Building2, Ellipsis, Mail, Pencil, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/utils";

import type { Client } from "../../_components/data";
import { statusMeta } from "../../_components/data";

interface ClientHeaderProps {
  client: Client;
}

export function ClientHeader({ client }: ClientHeaderProps) {
  const meta = statusMeta[client.status];

  return (
    <div className="flex flex-col gap-5 px-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-16 sm:size-20">
          <AvatarFallback className="text-lg">{getInitials(client.name)}</AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="truncate font-heading font-semibold text-xl leading-6 tracking-tight sm:text-2xl sm:leading-7">
              {client.name}
            </h1>
            <p className="truncate text-muted-foreground text-sm leading-5">
              {client.id} · {client.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
              <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
              {client.status}
            </Badge>
            <Badge className="gap-1.5 font-medium" variant="outline">
              {client.type === "Commercial" ? <Building2 className="size-3.5" /> : <User className="size-3.5" />}
              {client.type}
            </Badge>
            <Badge variant="outline">{client.accountOwner}</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <a href={`mailto:${client.email}`}>
            <Mail data-icon="inline-start" />
            Email
          </a>
        </Button>
        <Button size="sm">
          <Pencil data-icon="inline-start" />
          Edit details
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="More client actions" size="icon-sm" variant="outline">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>Log activity</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Archive client</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
