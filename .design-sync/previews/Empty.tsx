import { Button } from "@/components/ui/button";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty";
import { Inbox } from "lucide-react";

export function NoDeals() {
  return (
    <Empty className="w-full max-w-md">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>No open deals</EmptyTitle>
        <EmptyDescription>
          New leads land here the moment a quote request comes in.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Create a deal</Button>
      </EmptyContent>
    </Empty>
  );
}
