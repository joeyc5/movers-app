"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const leadChartValues = [22, 26, 19, 31, 28, 35, 30, 27, 41, 33, 29, 34] as const;

const leadChartConfig = {
  leads: {
    label: "Leads",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const axisMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
const tooltipMonthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" });

function getRollingMonthData(values: readonly number[]) {
  return values.map((leads, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (values.length - 1 - index));

    return {
      date: date.toISOString(),
      leads,
    };
  });
}

export function LeadFlow() {
  const leadChartData = getRollingMonthData(leadChartValues);
  const totalLeads = leadChartData.reduce((sum, item) => sum + item.leads, 0);
  const surveysBooked = 121;
  const surveyProgress = Math.round((surveysBooked / totalLeads) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Flow</CardTitle>
        <CardAction>
          <Select defaultValue="last-12-months">
            <SelectTrigger size="sm" className="min-w-40">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="last-30-days">Last 30 days</SelectItem>
                <SelectItem value="last-quarter">Last quarter</SelectItem>
                <SelectItem value="last-12-months">Last 12 months</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <ChartContainer config={leadChartConfig} className="h-72 w-full lg:col-span-8">
            <BarChart data={leadChartData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barSize={38}>
              <defs>
                <pattern
                  id="sales-leads-pattern"
                  width="4"
                  height="4"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="var(--color-leads)" fillOpacity="0.15" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="var(--color-leads)"
                    strokeWidth="1.25"
                    strokeOpacity="0.40"
                  />
                </pattern>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="0" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => axisMonthFormatter.format(new Date(String(value)))}
              />
              <YAxis hide />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(value) => tooltipMonthFormatter.format(new Date(String(value)))}
                  />
                }
              />
              <Bar
                dataKey="leads"
                fill="url(#sales-leads-pattern)"
                radius={[8, 8, 0, 0]}
                stroke="var(--color-leads)"
                strokeOpacity={0.5}
                strokeWidth={0.5}
              />
            </BarChart>
          </ChartContainer>

          <div className="flex flex-col gap-5 rounded-lg p-4 lg:col-span-4">
            <div className="flex flex-col gap-1">
              <div className="font-medium text-4xl tabular-nums leading-none">
                {totalLeads} <span className="font-normal text-lg text-muted-foreground">leads</span>
              </div>
              <p className="text-muted-foreground text-sm">Leads captured over the last 12 months.</p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
              <div className="text-xs text-muted-foreground uppercase tracking-widest">In-Home Surveys Booked</div>

              <div className="flex flex-col gap-1.5">
                <div className="font-medium text-2xl tabular-nums leading-none">
                  {surveysBooked} <span className="font-normal text-muted-foreground text-sm">surveys</span>
                </div>
                <p className="text-muted-foreground text-sm">{surveyProgress}% of leads booked an in-home estimate.</p>
              </div>

              <div className="flex flex-col gap-2 pt-0.5">
                <Progress
                  value={surveyProgress}
                  className="h-2.5 bg-chart-2/12 *:data-[slot='progress-indicator']:bg-chart-2"
                />
                <div className="flex items-center justify-between text-xs">
                  <div className="font-medium tabular-nums">{surveysBooked} booked</div>
                  <div className="text-muted-foreground tabular-nums">{totalLeads} leads</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
