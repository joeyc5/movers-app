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
