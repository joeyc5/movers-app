import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export function Default() {
  return (
    <RadioGroup defaultValue="local" className="flex flex-col gap-3">
      <Label className="flex items-center gap-2">
        <RadioGroupItem value="local" /> Local move
      </Label>
      <Label className="flex items-center gap-2">
        <RadioGroupItem value="long" /> Long distance
      </Label>
      <Label className="flex items-center gap-2">
        <RadioGroupItem value="commercial" /> Commercial
      </Label>
    </RadioGroup>
  );
}

export function Horizontal() {
  return (
    <RadioGroup defaultValue="am" className="flex items-center gap-4">
      <Label className="flex items-center gap-2">
        <RadioGroupItem value="am" /> Morning
      </Label>
      <Label className="flex items-center gap-2">
        <RadioGroupItem value="pm" /> Afternoon
      </Label>
    </RadioGroup>
  );
}
