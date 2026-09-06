import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function Sizes() {
  return (
    <div className="flex items-center gap-4">
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  );
}

export function InButton() {
  return (
    <div className="flex items-center gap-3">
      <Button disabled>
        <Spinner /> Sending estimate
      </Button>
      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner className="size-4" /> Syncing inventory
      </span>
    </div>
  );
}
