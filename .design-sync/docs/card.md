---
category: Data
---

The default container for a block of related content. `CardHeader` takes a title, a description, and an optional `CardAction` pinned to the right.

`size="sm"` tightens the padding, which is what stat tiles and sidebar panels use.

## Parts

Composed with `CardAction`, `CardContent`, `CardDescription`, `CardFooter`, `CardHeader`, `CardTitle`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";

export function DealSummary() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Deal #1042</CardTitle>
        <CardDescription>Acme Relocation, San Jose to Reno</CardDescription>
        <CardAction>
          <Badge variant="secondary">Quoted</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Two-bedroom, 184 items. Survey completed 12 March. Estimate valid 30 days.
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Send estimate</Button>
        <Button size="sm" variant="outline">Edit</Button>
      </CardFooter>
    </Card>
  );
}

export function Stat() {
  return (
    <Card size="sm" className="w-full max-w-xs">
      <CardHeader>
        <CardDescription>Open deals</CardDescription>
        <CardTitle className="text-3xl tabular-nums">27</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        Up 4 from last week
      </CardContent>
    </Card>
  );
}
```
