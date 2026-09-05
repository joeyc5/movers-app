import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="p-name">Client name</Label>
        <Input id="p-name" placeholder="Acme Relocation" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="p-email">Email</Label>
        <Input id="p-email" type="email" defaultValue="dispatch@acme.com" />
      </div>
    </div>
  );
}

export function States() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Invalid" aria-invalid />
      <Input type="file" />
    </div>
  );
}
