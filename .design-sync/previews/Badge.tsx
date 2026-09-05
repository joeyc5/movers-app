import { Badge } from "@/components/ui/badge";
import { Check, Clock } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>Booked</Badge>
      <Badge variant="secondary">Quoted</Badge>
      <Badge variant="destructive">Overdue</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="ghost">Archived</Badge>
    </div>
  );
}

export function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>
        <Check /> Paid
      </Badge>
      <Badge variant="secondary">
        <Clock /> Awaiting survey
      </Badge>
      <Badge variant="outline" className="tabular-nums">
        184 items
      </Badge>
    </div>
  );
}
