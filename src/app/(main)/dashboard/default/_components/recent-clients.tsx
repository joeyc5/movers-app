import Link from "next/link";

import { format } from "date-fns";
import { ArrowRight, Building2, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, getInitials } from "@/lib/utils";

import { clients, statusMeta } from "../../clients/_components/data";

const recentClients = [...clients]
  .sort((a, b) => new Date(b.lastActivityDate).getTime() - new Date(a.lastActivityDate).getTime())
  .slice(0, 8);

export function RecentClients() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">Recent Client Activity</CardTitle>
        <CardDescription>The clients with the latest touches, across every status.</CardDescription>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/clients">
              All clients
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 font-normal">Client</TableHead>
              <TableHead className="py-3 font-normal">Type</TableHead>
              <TableHead className="py-3 font-normal">Status</TableHead>
              <TableHead className="py-3 font-normal">Owner</TableHead>
              <TableHead className="py-3 text-right font-normal">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentClients.map((client) => {
              const meta = statusMeta[client.status];

              return (
                <TableRow key={client.id} className="border-border/60">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(client.name)}</AvatarFallback>
                      </Avatar>
                      <Link
                        className="truncate font-medium text-sm hover:underline"
                        href={`/dashboard/clients/${client.id}`}
                      >
                        {client.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge className="gap-1.5 font-medium" variant="outline">
                      {client.type === "Commercial" ? (
                        <Building2 className="size-3.5" />
                      ) : (
                        <User className="size-3.5" />
                      )}
                      {client.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge className={cn("gap-1.5 border px-2 py-1 font-medium", meta.badgeClass)} variant="outline">
                      <span className={cn("size-1.5 rounded-full", meta.dotClass)} />
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 text-sm">{client.accountOwner}</TableCell>
                  <TableCell className="py-3 text-right text-sm">
                    {format(new Date(client.lastActivityDate), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
