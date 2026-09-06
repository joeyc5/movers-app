---
category: Data
---

A file chip: type icon, name, size, and an optional remove action. `AttachmentGroup` stacks several.

`orientation="vertical"` renders a thumbnail tile instead of a row, for image attachments.

## Parts

Composed with `AttachmentAction`, `AttachmentActions`, `AttachmentContent`, `AttachmentDescription`, `AttachmentGroup`, `AttachmentMedia`, `AttachmentTitle`, `AttachmentTrigger`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  Attachment, AttachmentAction, AttachmentActions, AttachmentContent,
  AttachmentDescription, AttachmentGroup, AttachmentMedia, AttachmentTitle,
} from "@/components/ui/attachment";
import { FileText, X } from "lucide-react";

export function Files() {
  return (
    <AttachmentGroup className="w-full max-w-md">
      <Attachment>
        <AttachmentMedia>
          <FileText />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>Estimate-1042.pdf</AttachmentTitle>
          <AttachmentDescription>184 KB</AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          <AttachmentAction size="icon-sm" variant="ghost" aria-label="Remove">
            <X />
          </AttachmentAction>
        </AttachmentActions>
      </Attachment>
      <Attachment size="sm">
        <AttachmentMedia>
          <FileText />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>Bill-of-lading.pdf</AttachmentTitle>
          <AttachmentDescription>96 KB</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </AttachmentGroup>
  );
}
```
