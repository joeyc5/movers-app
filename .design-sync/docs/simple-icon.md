---
category: Data
---

Renders a brand mark from the `simple-icons` package. Import the icon object and pass it to `icon`.

Use it for third-party integrations. For interface icons, use `lucide-react`.

## Examples

```tsx
import { SimpleIcon } from "@/components/simple-icon";
import { siGoogle, siQuickbooks, siStripe } from "simple-icons";

export function Brands() {
  return (
    <div className="flex items-center gap-5">
      <SimpleIcon icon={siStripe} className="size-7" />
      <SimpleIcon icon={siQuickbooks} className="size-7" />
      <SimpleIcon icon={siGoogle} className="size-7" />
    </div>
  );
}

export function InRow() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-sm">
      <div className="flex items-center gap-3">
        <SimpleIcon icon={siStripe} className="size-5" />
        <span>Stripe — payments connected</span>
      </div>
      <div className="flex items-center gap-3">
        <SimpleIcon icon={siQuickbooks} className="size-5" />
        <span>QuickBooks — invoices synced</span>
      </div>
    </div>
  );
}
```
