"use client";

import { useTransition } from "react";

import { Check, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { QuoteDetail } from "@/server/queries/quotes";
import { decideQuote, deleteQuoteDraft, sendQuote } from "@/server/quote-actions";

/**
 * Lifecycle controls, offered only to staff whose writes succeed. Sending
 * locks pricing and accepting rewrites the deal's value, so both state their
 * consequence before asking for the click.
 */
export function QuoteLifecycleActions({ quote, dealCode }: { quote: QuoteDetail; dealCode: string }) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
    });
  }

  if (quote.status === "Draft") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              <Send />
              Send quote
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Send {quote.code} for {formatCurrency(quote.totalAmount)}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sending locks this quote&apos;s pricing. To change the price afterward, create a new quote on the deal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(() => sendQuote(quote.id, dealCode))}>Send quote</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" disabled={pending} className="text-muted-foreground">
              <Trash2 />
              Delete draft
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft {quote.code}?</AlertDialogTitle>
              <AlertDialogDescription>The draft and its line items are removed for good.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={() => run(() => deleteQuoteDraft(quote.id, dealCode))}
              >
                Delete draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (quote.status === "Sent" || quote.status === "Viewed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              <Check />
              Mark accepted
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark {quote.code} accepted?</AlertDialogTitle>
              <AlertDialogDescription>
                The deal&apos;s estimated value becomes {formatCurrency(quote.totalAmount)} and this quote can no longer
                change.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(() => decideQuote(quote.id, dealCode, "Accepted"))}>
                Mark accepted
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => decideQuote(quote.id, dealCode, "Declined"))}
        >
          <X />
          Mark declined
        </Button>
      </div>
    );
  }

  return null;
}
