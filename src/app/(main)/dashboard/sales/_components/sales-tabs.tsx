"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { buildBoard, type PipelineDeal } from "./data";
import { LeadsPanel } from "./leads/leads-panel";
import { PipelineBoard } from "./pipeline/pipeline-board";

export function SalesTabs({ deals }: { deals: PipelineDeal[] }) {
  return (
    <Tabs defaultValue="pipeline">
      <TabsList variant="line">
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        <TabsTrigger value="leads">Leads</TabsTrigger>
      </TabsList>

      <TabsContent className="pt-4" value="pipeline">
        <PipelineBoard initialBoard={buildBoard(deals)} />
      </TabsContent>

      <TabsContent className="pt-4" value="leads">
        <LeadsPanel deals={deals} />
      </TabsContent>
    </Tabs>
  );
}
