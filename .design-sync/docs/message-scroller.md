---
category: Messaging
---

A scrolling message list that keeps its position when new items arrive. Wrap it in `MessageScrollerProvider`, then nest viewport, content, and items.

Every `MessageScrollerItem` needs a stable `id` so the scroller can anchor to it.

## Parts

Composed with `MessageScrollerButton`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerProvider`, `MessageScrollerViewport`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import {
  MessageScroller, MessageScrollerContent, MessageScrollerItem,
  MessageScrollerProvider, MessageScrollerViewport,
} from "@/components/ui/message-scroller";

const thread = [
  { id: "1", who: "DR", name: "Dana Ramos", text: "Survey done — 184 items." },
  { id: "2", who: "KI", name: "Kim Ide", text: "Crating quote added." },
  { id: "3", who: "PO", name: "Pat O'Brien", text: "Truck 4 is reserved for Thursday." },
];

export function Thread() {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="border-border h-56 w-full max-w-md rounded-md border">
        <MessageScrollerViewport>
          <MessageScrollerContent className="flex flex-col gap-3 p-3">
            {thread.map((m) => (
              <MessageScrollerItem key={m.id} id={m.id}>
                <Message>
                  <MessageAvatar>
                    <Avatar className="size-8">
                      <AvatarFallback>{m.who}</AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <MessageHeader>{m.name}</MessageHeader>
                    {m.text}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
```
