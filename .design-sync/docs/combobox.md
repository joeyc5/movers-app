---
category: Forms
---

A select with a text filter, built on Base UI. Pass the option list to `items` on the root so filtering and keyboard navigation work.

`ComboboxChips` turns it into a multi-select with removable chips.

## Parts

Composed with `ComboboxChip`, `ComboboxChips`, `ComboboxChipsInput`, `ComboboxCollection`, `ComboboxContent`, `ComboboxEmpty`, `ComboboxGroup`, `ComboboxInput`, `ComboboxItem`, `ComboboxLabel`, `ComboboxList`, `ComboboxSeparator`, `ComboboxTrigger`, `ComboboxValue`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxList,
} from "@/components/ui/combobox";

const crews = ["Crew A — Dana Ramos", "Crew B — Kim Ide", "Crew C — Pat O'Brien", "Crew D — contract"];

export function AssignCrew() {
  return (
    <div className="w-full max-w-sm">
      <Combobox items={crews} defaultValue={crews[0]} defaultOpen modal={false}>
        <ComboboxInput placeholder="Assign a crew" />
        <ComboboxContent>
          <ComboboxEmpty>No crew matched.</ComboboxEmpty>
          <ComboboxList>
            {crews.map((crew) => (
              <ComboboxItem key={crew} value={crew}>
                {crew}
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
```
