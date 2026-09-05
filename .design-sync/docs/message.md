---
category: Messaging
---

One entry in a conversation: avatar, author, body, timestamp. `MessageGroup` stacks a thread.

Use it for internal notes and client threads. For a chat transcript with alignment, use `Bubble`.

## Parts

Composed with `MessageAvatar`, `MessageContent`, `MessageFooter`, `MessageGroup`, `MessageHeader`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader,
} from "@/components/ui/message";

export function Thread() {
  return (
    <MessageGroup className="w-full max-w-md">
      <Message>
        <MessageAvatar>
          <Avatar className="size-8">
            <AvatarFallback>DR</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>Dana Ramos</MessageHeader>
          Survey is done. 184 items, piano needs a crate.
          <MessageFooter>9:14 AM</MessageFooter>
        </MessageContent>
      </Message>
      <Message>
        <MessageAvatar>
          <Avatar className="size-8">
            <AvatarFallback>KI</AvatarFallback>
          </Avatar>
        </MessageAvatar>
        <MessageContent>
          <MessageHeader>Kim Ide</MessageHeader>
          Crating quote added to the estimate.
          <MessageFooter>9:22 AM</MessageFooter>
        </MessageContent>
      </Message>
    </MessageGroup>
  );
}
```
