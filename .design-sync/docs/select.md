---
category: Forms
---

The styled dropdown. `SelectTrigger` holds a `SelectValue`; `SelectContent` holds the items, optionally grouped with `SelectGroup` and `SelectLabel`.

Every `SelectItem` needs a unique `value`. Empty string values break the trigger's placeholder.

## Parts

Composed with `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectScrollDownButton`, `SelectScrollUpButton`, `SelectSeparator`, `SelectTrigger`, `SelectValue`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function Closed() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="sel-stage">Deal stage</Label>
      <Select defaultValue="quoted">
        <SelectTrigger id="sel-stage">
          <SelectValue placeholder="Pick a stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Pipeline</SelectLabel>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="surveyed">Surveyed</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value="lost">Lost</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Open() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Select defaultValue="crew-a" defaultOpen>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="crew-a">Crew A — Dana Ramos</SelectItem>
          <SelectItem value="crew-b">Crew B — Kim Ide</SelectItem>
          <SelectItem value="crew-c">Crew C — Pat O'Brien</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```
