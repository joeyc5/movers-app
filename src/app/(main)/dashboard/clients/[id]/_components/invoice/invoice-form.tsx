import { Separator } from "@/components/ui/separator";

import { InvoiceAdjustments } from "./invoice-adjustments";
import { InvoiceDetails } from "./invoice-details";
import { InvoiceItems } from "./invoice-items";

export function InvoiceForm() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <InvoiceDetails />

      <Separator />

      <InvoiceItems />

      <Separator />

      <InvoiceAdjustments />
    </div>
  );
}
