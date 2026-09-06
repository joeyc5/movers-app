import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export function ClientCard() {
  return (
    <HoverCard defaultOpen openDelay={0}>
      <HoverCardTrigger asChild>
        <Button variant="link">Acme Relocation</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>AR</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Acme Relocation</p>
            <p className="text-muted-foreground text-sm">
              Commercial account since 2019. Four open deals, $18,400 outstanding.
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
