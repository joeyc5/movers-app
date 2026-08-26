"use client";

import { addDays, format, parseISO, subDays } from "date-fns";
import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Weekly operations volume for the trailing quarter. Deterministic
// pseudo-random walk so the chart is stable across renders without
// checking in 90 rows of literals.
const DAYS = 90;

function buildChartData() {
  const start = subDays(new Date(), DAYS - 1);
  let seed = 42;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return Array.from({ length: DAYS }, (_, index) => {
    const date = addDays(start, index);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;
    const seasonLift = index > 55 ? 1 : 0;

    const jobs = Math.round((isWeekend ? 1 : 2) + next() * 2 + seasonLift);
    const surveys = Math.round((isWeekend ? 0 : 1) + next() * 2);
    const storageVisits = Math.round(next() * 2);

    return {
      date: format(date, "yyyy-MM-dd"),
      jobs,
      surveys,
      storageVisits,
    };
  });
}

const chartData = buildChartData();

const chartConfig = {
  jobs: {
    label: "Jobs",
    color: "var(--chart-1)",
  },
  surveys: {
    label: "Surveys",
    color: "var(--chart-2)",
  },
  storageVisits: {
    label: "Storage Visits",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export function PerformanceOverview() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Operations Volume</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Jobs, surveys, and storage visits for the last 3 months</span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select defaultValue="quarter">
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="3 months" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Period</SelectLabel>
                <SelectItem value="quarter">3 months</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger size="sm" className="w-36">
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Location</SelectLabel>
                <SelectItem value="all">All locations</SelectItem>
                <SelectItem value="oakland">Oakland Warehouse</SelectItem>
                <SelectItem value="san-jose">San Jose Branch</SelectItem>
                <SelectItem value="fremont">Fremont Depot</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            View report
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <ComposedChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillJobs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-jobs)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--color-jobs)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
              tickFormatter={(value) =>
                parseISO(value).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-50"
                  indicator="line"
                  labelFormatter={(value) => format(parseISO(value), "d MMMM yyyy")}
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <Area
              dataKey="jobs"
              type="natural"
              fill="url(#fillJobs)"
              stroke="var(--color-jobs)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
            <Line dataKey="surveys" type="natural" stroke="var(--color-surveys)" strokeWidth={1.4} dot={false} />
            <Line
              dataKey="storageVisits"
              type="natural"
              stroke="var(--color-storageVisits)"
              strokeWidth={1.4}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
