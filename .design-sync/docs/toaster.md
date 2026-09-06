---
category: Feedback
---

The toast host, built on Sonner. Mount `Toaster` once at the app root, then call `toast()` from anywhere.

Toasts confirm that something happened. For anything the user must act on, use an `Alert` or a dialog.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export function Triggers() {
  return (
    <div className="flex flex-col items-start gap-3">
      <Toaster position="top-center" />
      <p className="text-muted-foreground text-sm">
        Mount <code>&lt;Toaster /&gt;</code> once at the app root, then call <code>toast()</code> anywhere.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => toast("Estimate sent to Acme Relocation")}>
          Notify
        </Button>
        <Button size="sm" variant="outline" onClick={() => toast.success("Invoice #1042 paid")}>
          Success
        </Button>
        <Button size="sm" variant="destructive" onClick={() => toast.error("Crew A is double-booked")}>
          Error
        </Button>
      </div>
    </div>
  );
}
```
