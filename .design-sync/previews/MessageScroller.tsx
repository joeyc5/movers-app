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
