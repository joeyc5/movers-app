"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";

import type { Client } from "../../../_components/data";
import { getDefaultInvoiceValues, type InvoiceFormValues } from "./data";
import { InvoiceForm } from "./invoice-form";
import { InvoicePreview } from "./invoice-preview";

export function Invoice({ client }: { client: Client }) {
  const form = useForm<InvoiceFormValues>({
    defaultValues: getDefaultInvoiceValues(client),
  });
  const invoice = useWatch({ control: form.control }) as InvoiceFormValues;

  return (
    <FormProvider {...form}>
      <form className="grid gap-5 xl:grid-cols-2" noValidate onSubmit={(event) => event.preventDefault()}>
        <InvoiceForm />
        <InvoicePreview invoice={invoice} />
      </form>
    </FormProvider>
  );
}
