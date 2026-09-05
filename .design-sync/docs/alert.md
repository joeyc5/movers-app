---
category: Feedback
---

An inline message about the surrounding content. Put an icon first, then `AlertTitle` and `AlertDescription`.

`variant="destructive"` is for failures and overdue states. `AlertAction` holds a button on the right.

## Parts

Composed with `AlertAction`, `AlertDescription`, `AlertTitle`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

export function Default() {
  return (
    <Alert className="w-full max-w-md">
      <Info />
      <AlertTitle>Survey scheduled</AlertTitle>
      <AlertDescription>A surveyor visits Acme Relocation on Thursday at 9am.</AlertDescription>
    </Alert>
  );
}

export function Destructive() {
  return (
    <Alert variant="destructive" className="w-full max-w-md">
      <AlertTriangle />
      <AlertTitle>Invoice overdue</AlertTitle>
      <AlertDescription>Invoice #884 is 12 days past due.</AlertDescription>
      <AlertAction>
        <Button size="sm" variant="outline">Send reminder</Button>
      </AlertAction>
    </Alert>
  );
}
```
