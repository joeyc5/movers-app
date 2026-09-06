---
category: Data
---

A list row: media on the left, title and description in the middle, actions on the right. Use it for client lists, crew lists, and search results, where a `Card` per row would be too heavy.

`ItemGroup` stacks rows and `ItemSeparator` divides them.

## Parts

Composed with `ItemActions`, `ItemContent`, `ItemDescription`, `ItemFooter`, `ItemGroup`, `ItemHeader`, `ItemMedia`, `ItemSeparator`, `ItemTitle`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item, ItemActions, ItemContent, ItemDescription, ItemGroup,
  ItemMedia, ItemSeparator, ItemTitle,
} from "@/components/ui/item";
import { ChevronRight } from "lucide-react";

export function List() {
  return (
    <ItemGroup className="w-full max-w-md">
      <Item>
        <ItemMedia variant="icon">
          <Avatar className="size-8">
            <AvatarFallback>AR</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Acme Relocation</ItemTitle>
          <ItemDescription>Deal #1042 — quoted 12 March</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Badge variant="secondary">Quoted</Badge>
        </ItemActions>
      </Item>
      <ItemSeparator />
      <Item>
        <ItemMedia variant="icon">
          <Avatar className="size-8">
            <AvatarFallback>BH</AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Beckett Household</ItemTitle>
          <ItemDescription>Deal #1039 — crew B assigned</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="ghost" size="icon" aria-label="Open">
            <ChevronRight />
          </Button>
        </ItemActions>
      </Item>
    </ItemGroup>
  );
}

export function Variants() {
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Outline</ItemTitle>
          <ItemDescription>Bordered row for standalone use.</ItemDescription>
        </ItemContent>
      </Item>
      <Item variant="muted" size="sm">
        <ItemContent>
          <ItemTitle>Muted, small</ItemTitle>
          <ItemDescription>Quieter row inside a panel.</ItemDescription>
        </ItemContent>
      </Item>
    </div>
  );
}
```
