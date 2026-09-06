import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="l-origin">Origin address</Label>
      <Input id="l-origin" placeholder="1200 Market St, San Jose" />
    </div>
  );
}

export function WithControl() {
  return (
    <Label className="flex items-center gap-2">
      <Checkbox defaultChecked /> Send the crew a text reminder
    </Label>
  );
}
