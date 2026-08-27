import Link from "next/link";

import { CalendarCheck, DollarSign, UserPlus, Warehouse } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getDashboardMetrics } from "@/server/queries/dashboard";

/**
 * Measured from the same tables the linked screens read. No trend badges:
 * the seed data carries no prior period, and an invented delta is a lie.
 */
export async function MetricCards() {
  const metrics = await getDashboardMetrics();

  const cards = [
    {
      icon: CalendarCheck,
      label: "Jobs This Week",
      value: String(metrics.jobsThisWeek.total),
      detail: `${metrics.jobsThisWeek.moves} moves and ${metrics.jobsThisWeek.surveys} surveys on the board`,
      href: "/dashboard/calendar",
    },
    {
      icon: DollarSign,
      label: "Booked Revenue",
      value: formatCurrency(metrics.booked.total, { noDecimals: true }),
      detail: `${metrics.booked.wonDeals} won ${metrics.booked.wonDeals === 1 ? "deal" : "deals"}`,
      href: "/dashboard/sales",
    },
    {
      icon: Warehouse,
      label: "Storage Occupancy",
      value: `${metrics.storage.percent}%`,
      detail: `${metrics.storage.occupiedCubicFt.toLocaleString("en-US")} of ${metrics.storage.capacityCubicFt.toLocaleString("en-US")} ft³ across ${metrics.storage.vaultCount} vaults`,
      href: "/dashboard/warehouse",
    },
    {
      icon: UserPlus,
      label: "Open Leads",
      value: String(metrics.openLeads.count),
      detail: `${formatCurrency(metrics.openLeads.value, { noDecimals: true })} in open pipeline value`,
      href: "/dashboard/sales",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader>
            <CardTitle>
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                <card.icon className="size-4" />
              </div>
            </CardTitle>
            <CardDescription>{card.label}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <Link
              href={card.href}
              className="w-fit font-medium text-3xl tabular-nums leading-none tracking-tight hover:underline"
            >
              {card.value}
            </Link>
            <p className="text-muted-foreground text-sm">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
