import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRightIcon,
} from "lucide-react";
import { NavGroup } from "@/navigation/sidebar/sidebar-items";

interface Collapsible05Props {
  groups: NavGroup[];
}

export function Collapsible05({ groups }: Collapsible05Props) {
  return (
    <nav className="w-full max-w-60 space-y-1 rounded-lg border p-2">
      {groups.map((group) => (
        <Collapsible key={group.id} defaultOpen={group.id === 1}>
          <CollapsibleTrigger className="group/nav hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium">
            {group.items[0]?.icon && <group.items[0].icon className="text-muted-foreground size-4 shrink-0" />}
            {group.label}
            <ChevronRightIcon className="text-muted-foreground ml-auto size-4 shrink-0 transition-transform group-data-[panel-open]/nav:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1 ml-4 space-y-0.5 border-l pl-4">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    className="hover:bg-accent text-muted-foreground hover:text-foreground block rounded-md px-2 py-1.5 text-sm"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </nav>
  );
}

export default Collapsible05;
