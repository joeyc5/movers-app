"use client";

import { useTransition } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createQuote } from "@/server/quote-actions";

export function NewQuoteButton({
  dealCode,
  variant = "default",
}: {
  dealCode: string;
  variant?: "default" | "outline";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await createQuote(dealCode);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <Plus />
      {pending ? "Creating…" : "New quote"}
    </Button>
  );
}
