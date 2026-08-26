import { CalendarCheck, DollarSign, TrendingDown, TrendingUp, UserPlus, Warehouse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCards() {
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <CalendarCheck className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Jobs This Week</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">6</div>
            <Badge>
              <TrendingUp className="size-3" />
              +2
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">4 moves and 2 surveys on the board</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <DollarSign className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Booked Revenue This Month</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">$21,100</div>
            <Badge>
              <TrendingUp className="size-3" />
              +48%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Up from $14,300 last month</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <Warehouse className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Storage Occupancy</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">52%</div>
            <Badge variant="destructive">
              <TrendingDown className="size-3" />
              -3%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">4,110 of 7,900 ft³ across 14 vaults</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
              <UserPlus className="size-4" />
            </div>
          </CardTitle>
          <CardDescription>Open Leads</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-3xl tabular-nums leading-none tracking-tight">11</div>
            <Badge>
              <TrendingUp className="size-3" />
              +4
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">$89,250 in open pipeline value</p>
        </CardContent>
      </Card>
    </div>
  );
}
