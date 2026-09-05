import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";

export function Fallbacks() {
  return (
    <div className="flex items-center gap-3">
      <Avatar>
        <AvatarFallback>DR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>KI</AvatarFallback>
        <AvatarBadge className="bg-emerald-500" />
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback>PO</AvatarFallback>
      </Avatar>
    </div>
  );
}

export function Group() {
  return (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>DR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>KI</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>PO</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  );
}
