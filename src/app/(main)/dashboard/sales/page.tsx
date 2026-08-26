import { deals } from "./_components/data";
import { KpiCards } from "./_components/kpi-cards";
import { LeadFlow } from "./_components/lead-flow";
import { SalesTabs } from "./_components/sales-tabs";

export default function Page() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Sales</h1>
        <p className="text-muted-foreground text-sm">Leads and deals from first call to booked move.</p>
      </div>

      <KpiCards />
      <LeadFlow />
      <SalesTabs deals={deals} />
    </div>
  );
}
