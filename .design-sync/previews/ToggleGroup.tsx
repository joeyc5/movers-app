import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

export function SingleSelect() {
  return (
    <ToggleGroup type="single" defaultValue="month">
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month">Month</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function MultiSelect() {
  return (
    <ToggleGroup type="multiple" variant="outline" defaultValue={["left"]}>
      <ToggleGroupItem value="left" aria-label="Align left">
        <AlignLeft />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <AlignCenter />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <AlignRight />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
