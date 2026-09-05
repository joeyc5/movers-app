import { Kbd, KbdGroup } from "@/components/ui/kbd";

export function Keys() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Kbd>⌘</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>⇧</Kbd>
    </div>
  );
}

export function Shortcuts() {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">Open command menu</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">New deal</span>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>⇧</Kbd>
          <Kbd>D</Kbd>
        </KbdGroup>
      </div>
    </div>
  );
}
