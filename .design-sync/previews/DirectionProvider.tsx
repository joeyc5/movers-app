import { Button } from "@/components/ui/button";
import { DirectionProvider } from "@/components/ui/direction";
import { Input } from "@/components/ui/input";

export function LeftToRight() {
  return (
    <DirectionProvider dir="ltr">
      <div className="flex w-full max-w-sm items-center gap-2">
        <Input placeholder="Search deals" />
        <Button>Search</Button>
      </div>
    </DirectionProvider>
  );
}

export function RightToLeft() {
  return (
    <DirectionProvider dir="rtl">
      <div dir="rtl" className="flex w-full max-w-sm items-center gap-2">
        <Input placeholder="بحث" />
        <Button>بحث</Button>
      </div>
    </DirectionProvider>
  );
}
