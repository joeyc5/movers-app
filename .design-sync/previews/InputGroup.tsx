import {
  InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput,
  InputGroupText, InputGroupTextarea,
} from "@/components/ui/input-group";
import { Search, Send } from "lucide-react";

export function WithIcon() {
  return (
    <InputGroup className="w-full max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search deals, clients, invoices" />
    </InputGroup>
  );
}

export function WithSuffix() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>$</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput defaultValue="3,400" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>USD</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="Add a note for dispatch" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-sm" aria-label="Send">
            <Send />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

export function TextareaGroup() {
  return (
    <InputGroup className="w-full max-w-sm">
      <InputGroupTextarea rows={3} placeholder="Access notes for the crew" />
      <InputGroupAddon align="block-end">
        <InputGroupButton size="xs">Save note</InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
