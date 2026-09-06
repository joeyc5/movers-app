---
category: Forms
---

The browser's own select element with the design system's styling. It uses the platform picker, which is the right call on mobile and inside dense tables.

For search, multi-select, or custom item rendering, use `Select` or `Combobox`.

## Parts

Composed with `NativeSelectOptGroup`, `NativeSelectOption`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="ns-1">Move type</Label>
      <NativeSelect id="ns-1" defaultValue="local">
        <NativeSelectOption value="local">Local</NativeSelectOption>
        <NativeSelectOption value="long">Long distance</NativeSelectOption>
        <NativeSelectOption value="commercial">Commercial</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}

export function Grouped() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="ns-2">Assign to</Label>
      <NativeSelect id="ns-2" size="sm" defaultValue="ramos">
        <NativeSelectOptGroup label="Estimators">
          <NativeSelectOption value="ramos">Dana Ramos</NativeSelectOption>
          <NativeSelectOption value="ide">Kim Ide</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOptGroup label="Dispatch">
          <NativeSelectOption value="obrien">Pat O'Brien</NativeSelectOption>
        </NativeSelectOptGroup>
      </NativeSelect>
    </div>
  );
}
```
