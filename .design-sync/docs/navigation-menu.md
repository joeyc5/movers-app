---
category: Navigation
---

The top-level nav bar with dropdown panels. A `NavigationMenuItem` either links directly or opens a `NavigationMenuContent` panel.

Panels need a fixed width; the viewport measures them.

## Parts

Composed with `NavigationMenuContent`, `NavigationMenuIndicator`, `NavigationMenuItem`, `NavigationMenuLink`, `NavigationMenuList`, `NavigationMenuTrigger`, `NavigationMenuViewport`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink,
  NavigationMenuList, NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

export function Default() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Operations</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-64 gap-1 p-2">
              <li>
                <NavigationMenuLink href="#">Dispatch board</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#">Crew roster</NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink href="#">Warehouse</NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Clients</NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink href="#">Invoices</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}
```
