import Link from "next/link";
import { notFound } from "next/navigation";

import { getDealByCode } from "@/server/queries/deals";
import { canWriteQuotes, getQuoteContext, getQuotesForDeal } from "@/server/queries/quotes";

import { DealHeader } from "./_components/deal-header";
import { NewQuoteButton } from "./_components/new-quote-button";
import { QuoteBuilder } from "./_components/quote-builder";
import { QuoteRecord } from "./_components/quote-record";
import { QuoteSwitcher } from "./_components/quote-switcher";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ quote?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ id }, { quote: quoteParam }] = await Promise.all([params, searchParams]);

  const deal = await getDealByCode(id);
  if (!deal) notFound();

  const [quotes, canWrite] = await Promise.all([getQuotesForDeal(deal.uuid), canWriteQuotes()]);
  const selected = (quoteParam && quotes.find((quote) => quote.code === quoteParam)) || quotes[0];

  const editable = canWrite && selected?.status === "Draft";
  const context = editable ? await getQuoteContext() : null;

  const acceptedQuoteCode = deal.acceptedQuoteId
    ? quotes.find((quote) => quote.id === deal.acceptedQuoteId)?.code
    : undefined;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <DealHeader deal={deal} acceptedQuoteCode={acceptedQuoteCode} />

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">No quotes on this deal yet</p>
          {canWrite ? (
            <>
              <p className="max-w-xs text-muted-foreground text-sm">
                A new quote starts from the default rate card and this deal&apos;s move details.
              </p>
              <NewQuoteButton dealCode={deal.id} />
            </>
          ) : (
            <p className="max-w-xs text-muted-foreground text-sm">
              Someone with sales access creates the first quote from this page.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QuoteSwitcher dealCode={deal.id} quotes={quotes} selectedCode={selected.code} />
            {canWrite && <NewQuoteButton dealCode={deal.id} variant="outline" />}
          </div>

          {editable && context ? (
            <QuoteBuilder key={selected.id} quote={selected} dealCode={deal.id} context={context} />
          ) : (
            <QuoteRecord quote={selected} dealCode={deal.id} canWrite={canWrite} />
          )}
        </>
      )}

      <p className="text-muted-foreground text-sm">
        Back to{" "}
        <Link href="/dashboard/sales" className="font-medium text-foreground hover:underline">
          Sales
        </Link>
      </p>
    </div>
  );
}
