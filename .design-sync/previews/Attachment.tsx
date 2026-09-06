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
