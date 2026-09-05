import { Separator } from "@/components/ui/separator";

export function Horizontal() {
  return (
    <div className="w-full max-w-sm">
      <p className="text-sm font-medium">Deal #1042</p>
      <p className="text-muted-foreground text-sm">Acme Relocation</p>
      <Separator className="my-3" />
      <p className="text-muted-foreground text-sm">Quoted 12 March, valid 30 days.</p>
    </div>
  );
}

export function Vertical() {
  return (
    <div className="flex h-6 items-center gap-3 text-sm">
      <span>Clients</span>
      <Separator orientation="vertical" />
      <span>Deals</span>
      <Separator orientation="vertical" />
      <span>Invoices</span>
    </div>
  );
}
