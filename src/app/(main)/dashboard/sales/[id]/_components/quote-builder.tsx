"use client";

import * as React from "react";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { FeeCatalogOption, QuoteContext, QuoteDetail } from "@/server/queries/quotes";
import {
  addLineItem,
  type QuoteDraftPatch,
  removeLineItem,
  updateLineItem,
  updateQuoteDraft,
} from "@/server/quote-actions";

import { QuoteLifecycleActions } from "./quote-lifecycle-actions";
import { QuoteSummary } from "./quote-summary";

const feeCategoryLabels: Record<FeeCatalogOption["category"], string> = {
  accessorial: "Accessorials",
  materials: "Materials",
  specialty: "Specialty",
  surcharge: "Surcharges",
};

const SAVE_DELAY_MS = 600;

/**
 * Draft editor. Inputs hold their own values; every dollar figure renders
 * from the quote row the server returned after the last save, so the summary
 * is always the database's answer, never client arithmetic.
 */
export function QuoteBuilder({
  quote,
  dealCode,
  context,
}: {
  quote: QuoteDetail;
  dealCode: string;
  context: QuoteContext;
}) {
  const [isPending, startTransition] = React.useTransition();

  // Selects are controlled locally so they respond before the round-trip lands.
  const [rateCardId, setRateCardId] = React.useState(quote.rateCardId ?? context.rateCards[0]?.id ?? "");
  const [crewSize, setCrewSize] = React.useState(quote.crewSize);
  const [valuationType, setValuationType] = React.useState(quote.valuationType);
  const [discountType, setDiscountType] = React.useState(quote.discountType);
  const [depositType, setDepositType] = React.useState(quote.depositType);
  const [taxRateId, setTaxRateId] = React.useState(quote.taxRateId ?? "");
  const [addFeeValue, setAddFeeValue] = React.useState("");

  const patchRef = React.useRef<QuoteDraftPatch>({});
  const patchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPatch = React.useCallback(() => {
    if (patchTimer.current) clearTimeout(patchTimer.current);
    patchTimer.current = null;
    const patch = patchRef.current;
    patchRef.current = {};
    if (Object.keys(patch).length === 0) return;
    startTransition(async () => {
      const result = await updateQuoteDraft(quote.id, dealCode, patch);
      if (result?.error) toast.error(result.error);
    });
  }, [quote.id, dealCode]);

  const save = React.useCallback(
    (patch: QuoteDraftPatch, delay = SAVE_DELAY_MS) => {
      patchRef.current = { ...patchRef.current, ...patch };
      if (patchTimer.current) clearTimeout(patchTimer.current);
      if (delay === 0) {
        flushPatch();
      } else {
        patchTimer.current = setTimeout(flushPatch, delay);
      }
    },
    [flushPatch],
  );

  React.useEffect(() => {
    return () => {
      if (patchTimer.current) clearTimeout(patchTimer.current);
    };
  }, []);

  const lineTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const linePatches = React.useRef<Record<string, { quantity?: number; unitPrice?: number }>>({});

  function saveLine(lineId: string, patch: { quantity?: number; unitPrice?: number }) {
    linePatches.current[lineId] = { ...linePatches.current[lineId], ...patch };
    if (lineTimers.current[lineId]) clearTimeout(lineTimers.current[lineId]);
    lineTimers.current[lineId] = setTimeout(() => {
      const pending = linePatches.current[lineId];
      delete linePatches.current[lineId];
      delete lineTimers.current[lineId];
      if (!pending) return;
      startTransition(async () => {
        const result = await updateLineItem(lineId, dealCode, pending);
        if (result?.error) toast.error(result.error);
      });
    }, SAVE_DELAY_MS);
  }

  function runAction(action: () => Promise<{ error?: string } | undefined>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
    });
  }

  const selectedCard = context.rateCards.find((card) => card.id === rateCardId);
  const crewOptions = selectedCard?.crewRates ?? [];

  function changeRateCard(nextCardId: string) {
    const nextCard = context.rateCards.find((card) => card.id === nextCardId);
    if (!nextCard) return;
    setRateCardId(nextCardId);

    const sizes = nextCard.crewRates.map((rate) => rate.crewSize);
    let nextCrew = crewSize;
    if (!sizes.includes(nextCrew)) {
      nextCrew = sizes.reduce(
        (best, size) => (Math.abs(size - crewSize) < Math.abs(best - crewSize) ? size : best),
        sizes[0],
      );
      setCrewSize(nextCrew);
    }
    save({ rateCardId: nextCardId, crewSize: nextCrew }, 0);
  }

  const numberOrUndefined = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg leading-none tabular-nums">{quote.code}</CardTitle>
            <span className="text-muted-foreground text-sm">Draft</span>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <h3 className="font-medium tracking-tight">Labor</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-rate-card">
                  Rate card
                </FieldLabel>
                <Select value={rateCardId} onValueChange={changeRateCard}>
                  <SelectTrigger id="quote-rate-card" className="w-full">
                    <SelectValue placeholder="Select rate card" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {context.rateCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-crew">
                  Crew
                </FieldLabel>
                <Select
                  value={String(crewSize)}
                  onValueChange={(value) => {
                    const next = Number(value);
                    setCrewSize(next);
                    save({ crewSize: next }, 0);
                  }}
                >
                  <SelectTrigger id="quote-crew" className="w-full">
                    <SelectValue placeholder="Crew size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {crewOptions.map((rate) => (
                        <SelectItem key={rate.crewSize} value={String(rate.crewSize)}>
                          {rate.crewSize} movers ({formatCurrency(rate.hourlyRatePerMover)}/mover/h)
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-hours">
                  Estimated hours
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="quote-hours"
                    type="number"
                    min={0}
                    step={0.5}
                    defaultValue={quote.estimatedHours}
                    onChange={(event) => {
                      const hours = numberOrUndefined(event.target.value);
                      if (hours !== undefined) save({ estimatedHours: hours });
                    }}
                  />
                  <InputGroupAddon align="inline-end">h</InputGroupAddon>
                </InputGroup>
              </Field>
            </div>
            <p className="text-muted-foreground text-sm">
              {quote.crewSize} movers at {formatCurrency(quote.hourlyRatePerMover)}/mover/h · {quote.minHours}h minimum
              · {quote.otMultiplier}x after {quote.otThresholdHours}h ={" "}
              <span className="font-medium text-foreground tabular-nums">{formatCurrency(quote.laborTotal)}</span>
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium tracking-tight">Fees & materials</h3>
              <Select
                value={addFeeValue}
                onValueChange={(feeId) => {
                  setAddFeeValue("");
                  runAction(() => addLineItem(quote.id, dealCode, feeId));
                }}
              >
                <SelectTrigger size="sm" className="w-52">
                  <SelectValue placeholder="Add from catalog" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(feeCategoryLabels) as FeeCatalogOption["category"][]).map((category) => {
                    const fees = context.feeCatalog.filter((fee) => fee.category === category);
                    if (fees.length === 0) return null;
                    return (
                      <SelectGroup key={category}>
                        <SelectLabel>{feeCategoryLabels[category]}</SelectLabel>
                        {fees.map((fee) => (
                          <SelectItem key={fee.id} value={fee.id}>
                            {fee.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {quote.lineItems.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
                Labor only so far. Stairs, cartons, piano handling and surcharges come from the catalog.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {quote.lineItems.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="truncate text-sm">{item.description}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.pricingMode === "percent_of_labor"
                          ? "percent of labor"
                          : item.pricingMode === "flat"
                            ? "flat fee"
                            : `per ${item.pricingMode === "per_hour" ? "hour" : "unit"}`}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={item.pricingMode === "per_unit" ? 1 : 0.5}
                      defaultValue={item.quantity}
                      aria-label={`${item.description} quantity`}
                      className="w-20 text-right tabular-nums"
                      onChange={(event) => {
                        const quantity = numberOrUndefined(event.target.value);
                        if (quantity !== undefined) saveLine(item.id, { quantity });
                      }}
                    />
                    <InputGroup className="w-28">
                      <InputGroupInput
                        type="number"
                        min={0}
                        step="any"
                        defaultValue={item.unitPrice}
                        aria-label={`${item.description} rate`}
                        className="text-right tabular-nums"
                        onChange={(event) => {
                          const unitPrice = numberOrUndefined(event.target.value);
                          if (unitPrice !== undefined) saveLine(item.id, { unitPrice });
                        }}
                      />
                      <InputGroupAddon align="inline-end">
                        {item.pricingMode === "percent_of_labor" ? "%" : "$"}
                      </InputGroupAddon>
                    </InputGroup>
                    <span className="w-20 text-right text-sm tabular-nums">{formatCurrency(item.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${item.description}`}
                      className="text-muted-foreground"
                      onClick={() => runAction(() => removeLineItem(item.id, dealCode))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="font-medium tracking-tight">Coverage & adjustments</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-valuation">
                  Valuation coverage
                </FieldLabel>
                <Select
                  value={valuationType}
                  onValueChange={(value: QuoteDetail["valuationType"]) => {
                    setValuationType(value);
                    save({ valuationType: value }, 0);
                  }}
                >
                  <SelectTrigger id="quote-valuation" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Released Value">Released Value (included)</SelectItem>
                      <SelectItem value="Full Value Protection">Full Value Protection</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {valuationType === "Full Value Protection" && (
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="quote-valuation-fee">
                    Coverage fee
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="quote-valuation-fee"
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={quote.valuationFee}
                      onChange={(event) => {
                        const fee = numberOrUndefined(event.target.value);
                        if (fee !== undefined) save({ valuationFee: fee });
                      }}
                    />
                    <InputGroupAddon align="inline-end">$</InputGroupAddon>
                  </InputGroup>
                </Field>
              )}

              <div className="grid grid-cols-[1fr_112px] gap-3">
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="quote-discount-type">
                    Discount
                  </FieldLabel>
                  <Select
                    value={discountType}
                    onValueChange={(value: QuoteDetail["discountType"]) => {
                      setDiscountType(value);
                      save({ discountType: value }, 0);
                    }}
                  >
                    <SelectTrigger id="quote-discount-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percent">Percent</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="quote-discount-value">
                    Value
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="quote-discount-value"
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={quote.discountValue}
                      onChange={(event) => {
                        const value = numberOrUndefined(event.target.value);
                        if (value !== undefined) save({ discountValue: value });
                      }}
                    />
                    <InputGroupAddon align="inline-end">{discountType === "percent" ? "%" : "$"}</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>

              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-tax">
                  Tax
                </FieldLabel>
                <Select
                  value={taxRateId}
                  onValueChange={(value) => {
                    setTaxRateId(value);
                    save({ taxRateId: value }, 0);
                  }}
                >
                  <SelectTrigger id="quote-tax" className="w-full">
                    <SelectValue placeholder="Select tax" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {context.taxRates.map((tax) => (
                        <SelectItem key={tax.id} value={tax.id}>
                          {tax.name} ({tax.ratePercent}%)
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-[1fr_112px] gap-3">
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="quote-deposit-type">
                    Deposit
                  </FieldLabel>
                  <Select
                    value={depositType}
                    onValueChange={(value: QuoteDetail["depositType"]) => {
                      setDepositType(value);
                      save({ depositType: value }, 0);
                    }}
                  >
                    <SelectTrigger id="quote-deposit-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                        <SelectItem value="percent">Percent of total</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor="quote-deposit-value">
                    Value
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="quote-deposit-value"
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={quote.depositValue}
                      onChange={(event) => {
                        const value = numberOrUndefined(event.target.value);
                        if (value !== undefined) save({ depositValue: value });
                      }}
                    />
                    <InputGroupAddon align="inline-end">{depositType === "percent" ? "%" : "$"}</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="font-medium tracking-tight">Schedule & notes</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-move-date">
                  Move date
                </FieldLabel>
                <Input
                  id="quote-move-date"
                  type="date"
                  defaultValue={quote.moveDate ?? ""}
                  onChange={(event) => save({ moveDate: event.target.value || null }, 0)}
                />
              </Field>
              <Field className="gap-1">
                <FieldLabel className="text-xs" htmlFor="quote-valid-until">
                  Valid until
                </FieldLabel>
                <Input
                  id="quote-valid-until"
                  type="date"
                  defaultValue={quote.validUntil ?? ""}
                  onChange={(event) => save({ validUntil: event.target.value || null }, 0)}
                />
              </Field>
            </div>
            <Field className="gap-1">
              <FieldLabel className="text-xs" htmlFor="quote-notes">
                Notes for the client
              </FieldLabel>
              <Textarea
                id="quote-notes"
                rows={3}
                defaultValue={quote.notes ?? ""}
                onChange={(event) => save({ notes: event.target.value || null })}
              />
            </Field>
          </section>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-16">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base leading-none">Quote summary</CardTitle>
              <span aria-live="polite" className="text-muted-foreground text-xs">
                {isPending ? "Saving…" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <QuoteSummary quote={quote} />
            <QuoteLifecycleActions quote={quote} dealCode={dealCode} />
          </CardContent>
        </Card>
      </div>

      <div className="-mx-4 sticky bottom-0 border-t bg-background/80 px-4 py-2.5 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">{isPending ? "Saving…" : "Total"}</span>
            <span className="font-semibold tabular-nums">{formatCurrency(quote.totalAmount)}</span>
          </div>
          <QuoteLifecycleActions quote={quote} dealCode={dealCode} />
        </div>
      </div>
    </div>
  );
}
