---
category: Messaging
---

A chat bubble. `variant="sent"` aligns it to the right for the current user's messages.

`BubbleGroup` stacks a conversation. For a threaded list with authors and timestamps, use `Message`.

## Parts

Composed with `BubbleContent`, `BubbleGroup`, `BubbleReactions`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import { Bubble, BubbleContent, BubbleGroup } from "@/components/ui/bubble";

export function Conversation() {
  return (
    <BubbleGroup className="w-full max-w-md">
      <Bubble>
        <BubbleContent>Can we move the delivery to Thursday?</BubbleContent>
      </Bubble>
      <Bubble variant="sent">
        <BubbleContent>Thursday works. I will re-dispatch crew A.</BubbleContent>
      </Bubble>
      <Bubble>
        <BubbleContent>Perfect, thank you.</BubbleContent>
      </Bubble>
    </BubbleGroup>
  );
}
```
