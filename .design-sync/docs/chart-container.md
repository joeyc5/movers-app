---
category: Data
---

The Recharts wrapper that gives a chart the design system's colors, tooltip,
and legend. Pass a `config` keyed by series name; each key becomes a
`--color-<key>` CSS variable you reference from the series `fill` or `stroke`.

`ChartTooltip` needs `content={<ChartTooltipContent />}` to render the styled
tooltip. Set `initialDimension` when the chart renders before its container has
been measured.

Its preview card is the typographic floor card, not a render. `ChartContainer`
wraps Recharts' `ResponsiveContainer`, which only recognizes chart children
from its own module instance, and a preview that imports `BarChart` separately
gets a second copy and draws an empty box. In an app both come from the same
install and the chart renders normally.

## Examples

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";

const data = [
  { month: "Nov", booked: 18, lost: 6 },
  { month: "Dec", booked: 14, lost: 9 },
  { month: "Jan", booked: 21, lost: 5 },
  { month: "Feb", booked: 26, lost: 7 },
  { month: "Mar", booked: 31, lost: 4 },
];

const config = {
  booked: { label: "Booked", color: "var(--chart-2)" },
  lost: { label: "Lost", color: "var(--chart-4)" },
};

export function DealsByMonth() {
  return (
    <ChartContainer
      config={config}
      className="h-64 w-full max-w-md"
      initialDimension={{ width: 420, height: 256 }}
    >
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="booked" fill="var(--color-booked)" radius={4} />
        <Bar dataKey="lost" fill="var(--color-lost)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
```

## Parts

Composed with `ChartLegend`, `ChartLegendContent`, `ChartStyle`, `ChartTooltip`, `ChartTooltipContent`. Every part is a named export on `window.MoversCRM`.
