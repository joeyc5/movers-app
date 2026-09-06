import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor="t-notes">Move notes</Label>
      <Textarea
        id="t-notes"
        rows={4}
        defaultValue="Third floor walk-up, no elevator. Piano on the inventory."
      />
    </div>
  );
}

export function States() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Textarea placeholder="Add a note for dispatch" />
      <Textarea placeholder="Disabled" disabled />
    </div>
  );
}
