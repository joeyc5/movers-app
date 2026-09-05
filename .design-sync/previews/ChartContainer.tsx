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
