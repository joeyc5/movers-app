---
category: Actions
---

Joins related buttons into one connected control. Use it for segmented actions on a row or a card, and for split buttons where a primary action sits beside a menu trigger.

`ButtonGroupSeparator` divides a split button. `ButtonGroupText` prefixes the group with a static label.

## Parts

Composed with `ButtonGroupSeparator`, `ButtonGroupText`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@/components/ui/button-group";
import { ChevronDown, Copy, Pencil, Trash2 } from "lucide-react";

export function Actions() {
  return (
    <ButtonGroup>
      <Button variant="outline">
        <Pencil /> Edit
      </Button>
      <Button variant="outline">
        <Copy /> Duplicate
      </Button>
      <Button variant="outline">
        <Trash2 /> Delete
      </Button>
    </ButtonGroup>
  );
}

export function SplitButton() {
  return (
    <ButtonGroup>
      <Button>Send estimate</Button>
      <ButtonGroupSeparator />
      <Button size="icon" aria-label="More send options">
        <ChevronDown />
      </Button>
    </ButtonGroup>
  );
}

export function WithLabel() {
  return (
    <ButtonGroup>
      <ButtonGroupText>Crew</ButtonGroupText>
      <Button variant="outline">A</Button>
      <Button variant="outline">B</Button>
      <Button variant="outline">C</Button>
    </ButtonGroup>
  );
}
```
