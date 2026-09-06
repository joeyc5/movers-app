import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverDescription, PopoverHeader,
  PopoverTitle, PopoverTrigger,
} from "@/components/ui/popover";

export function QuickEdit() {
  return (
    <Popover defaultOpen modal={false}>
      <PopoverTrigger asChild>
        <Button variant="outline">Adjust quote</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>Adjust quote</PopoverTitle>
          <PopoverDescription>Applies to deal #1042 only.</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-3 pt-3">
          <Field>
            <FieldLabel htmlFor="pop-hours">Crew hours</FieldLabel>
            <Input id="pop-hours" defaultValue="6" />
          </Field>
          <Button size="sm">Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
