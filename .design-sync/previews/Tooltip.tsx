import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Archive } from "lucide-react";

export function Default() {
  return (
    <Tooltip defaultOpen>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Archive">
          <Archive />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Archive this deal</TooltipContent>
    </Tooltip>
  );
}
