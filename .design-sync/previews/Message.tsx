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
