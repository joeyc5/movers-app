import { AspectRatio } from "@/components/ui/aspect-ratio";

export function Wide() {
  return (
    <div className="w-full max-w-sm">
      <AspectRatio ratio={16 / 9}>
        <div className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-md text-sm">
          16 / 9 — warehouse photo
        </div>
      </AspectRatio>
    </div>
  );
}

export function Square() {
  return (
    <div className="w-40">
      <AspectRatio ratio={1}>
        <div className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-md text-sm">
          1 / 1
        </div>
      </AspectRatio>
    </div>
  );
}
