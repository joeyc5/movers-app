# Page patterns

How screens are put together in Movers CRM. These are the shapes the product
already uses, not aspirations.

## Page shell

Every dashboard page is a vertical stack with a title block on top:

```jsx
<div className="flex flex-col gap-4">
  <div className="flex flex-col gap-0.5">
    <h1 className="font-heading text-xl font-semibold tracking-tight">Clients</h1>
    <p className="text-muted-foreground text-sm">
      Look up a household or business account and its history.
    </p>
  </div>

  {/* the panel */}
</div>
```

The subtitle says what the page is for in one sentence. Skip it rather than
restate the title.

## Panels

A page holds one panel, or a small number of them. A panel is a `Card` when it
needs a header and a footer, and a bare `Table` or `ItemGroup` when it does
not. Do not nest a `Card` inside a `Card`.

Filters and the primary action sit in a row above the data, not inside the
card header.

## Status

Deal stages, invoice states, and crew availability are `Badge`s.
`variant="secondary"` is the neutral state, `variant="destructive"` is the one
that needs attention, `variant="outline"` is a draft. Do not use color alone:
the badge text says what the state is.

## Tables

Right-align money and counts, and add `tabular-nums` to the cell so columns
line up. Put row actions in a `DropdownMenu` behind a `MoreHorizontal` trigger
at the end of the row. `TableCaption` describes the row set.

## Empty and loading

Every list has an `Empty` state that names what will appear and offers the
action that creates the first one. While data loads, render `Skeleton` shaped
like the rows it replaces, so the layout does not jump.

## Density

Dispatch and warehouse screens read in bulk. Prefer `size="sm"` on buttons and
`Item` rows over `Card` grids once a list passes about ten entries.
