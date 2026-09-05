# Movers CRM design system

The component library behind a multi-tenant CRM for moving companies. It is
shadcn/ui on Radix and Base UI, styled with Tailwind CSS v4 against a token
layer of CSS custom properties. Every component in this bundle is the real
compiled source the product ships.

## Setup

Wrap the app once, at the root:

```jsx
const { TooltipProvider } = window.MoversCRM;

<TooltipProvider>
  {/* your screens */}
</TooltipProvider>
```

Every `Tooltip` throws without it, and tooltips are the only label an
icon-only button carries on desktop.

Two components own their own provider and must be wrapped where they are used,
not at the root: `Sidebar` needs `SidebarProvider` around both the sidebar and
the page body it sits beside, and `MessageScroller` needs
`MessageScrollerProvider`.

Dark mode is a `dark` class on an ancestor. Nothing else switches it.

## Styling

Style with Tailwind utilities that resolve to the design tokens. Never write a
raw hex value or a pixel font size; the token is what makes a screen match the
product and survive a theme change.

| Family | Utilities |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-sidebar` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-primary`, `text-destructive` |
| Accents | `bg-primary` + `text-primary-foreground`, `bg-secondary` + `text-secondary-foreground`, `bg-accent` + `text-accent-foreground`, `bg-destructive` |
| Lines | `border-border`, `border-input`, `ring-ring`, `divide-border` |
| Charts | `--chart-1` through `--chart-5`, referenced as `var(--chart-2)` |
| Radius | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl` — all derived from `--radius` |
| Type | `font-sans` (Geist), `font-mono` (Geist Mono), `font-heading` |

Pair every surface with its matching foreground: `bg-card text-card-foreground`,
`bg-primary text-primary-foreground`. A surface utility on its own leaves text
at the inherited color and fails contrast in one of the two themes.

Numbers in tables, stat tiles, and money columns take `tabular-nums`.

Layout is plain Tailwind: `flex`, `grid`, `gap-*`, `p-*`, `size-*`, and the
`sm:` / `md:` / `lg:` breakpoints. Use those for your own scaffolding and let
the components handle their internal spacing.

## Where the truth lives

- `_ds/<folder>/styles.css` and the files it imports hold every token and every
  compiled utility. Read it before inventing a class name.
- `components/<group>/<Name>/<Name>.prompt.md` carries usage, the sub-part
  list, and a working example for each component.
- `components/<group>/<Name>/<Name>.d.ts` is the prop contract, extracted from
  the product's own TypeScript.

Compound components ship their parts as separate exports on the same global:
`Card` comes with `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, and
`CardAction`. The parts are listed in each component's `## Parts` section and
are not separate cards in the picker.

## A screen, built the way the product builds them

```jsx
const { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent,
        Badge, Button, Table, TableHeader, TableBody, TableRow, TableHead,
        TableCell } = window.MoversCRM;

<div className="bg-background flex flex-col gap-6 p-6">
  <div className="flex items-center justify-between gap-4">
    <h1 className="font-heading text-xl font-semibold tracking-tight">Open deals</h1>
    <Button>New deal</Button>
  </div>

  <Card>
    <CardHeader>
      <CardTitle>This week</CardTitle>
      <CardDescription>Deals scheduled between 16 and 22 March</CardDescription>
      <CardAction>
        <Badge variant="secondary">27 open</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium tabular-nums">#1042</TableCell>
            <TableCell>Acme Relocation</TableCell>
            <TableCell className="text-right tabular-nums">$3,400</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</div>
```
