"use client";

import { useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateCompanyBillingProfile } from "@/server/company-actions";

/** The remittance block printed on every invoice this company sends. */
export type CompanyBillingView = {
  name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  tax_id: string | null;
  payment_account_name: string | null;
  routing_number: string | null;
} | null;

// Mirrors the server action's schema so the form refuses the same input the
// action would. Banking fields are optional there and omitted below unless the
// caller has Full access.
const formSchema = z.object({
  name: z.string().trim().max(200),
  email: z.union([z.email("Enter a valid email."), z.literal("")]),
  phone: z.string().trim().max(50),
  website: z.string().trim().max(200),
  addressLine1: z.string().trim().max(200),
  addressLine2: z.string().trim().max(200),
  taxId: z.string().trim().max(100),
  paymentAccountName: z.string().trim().max(200),
  routingNumber: z.string().trim().max(50),
});

type FormValues = z.infer<typeof formSchema>;

function TextField({
  control,
  name,
  label,
  description,
  disabled,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  label: string;
  description?: string;
  disabled: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field className="gap-1.5" data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`company-${name}`}>{label}</FieldLabel>
          <Input {...field} id={`company-${name}`} disabled={disabled} aria-invalid={fieldState.invalid} />
          {description ? <FieldDescription>{description}</FieldDescription> : null}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}

export function CompanyPanel({
  billing,
  canEdit,
  showBanking,
}: {
  billing: CompanyBillingView;
  canEdit: boolean;
  showBanking: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: billing?.name ?? "",
      email: billing?.email ?? "",
      phone: billing?.phone ?? "",
      website: billing?.website ?? "",
      addressLine1: billing?.address_line1 ?? "",
      addressLine2: billing?.address_line2 ?? "",
      taxId: billing?.tax_id ?? "",
      paymentAccountName: billing?.payment_account_name ?? "",
      routingNumber: billing?.routing_number ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      // The action ignores banking fields for a caller without Full access;
      // omitting them keeps a Scoped settings-holder from sending values the
      // form never showed them.
      const result = await updateCompanyBillingProfile(
        showBanking ? values : { ...values, paymentAccountName: undefined, routingNumber: undefined },
      );
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Company details saved.");
      form.reset(values);
    });
  }

  const disabled = !canEdit || pending;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">Company details</CardTitle>
        <CardDescription>
          {canEdit
            ? "This block prints at the top of every invoice you send."
            : "This block prints at the top of every invoice you send. Your role cannot change it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form className="flex flex-col gap-6" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="name" label="Company name" disabled={disabled} />
            <TextField control={form.control} name="email" label="Billing email" disabled={disabled} />
            <TextField control={form.control} name="phone" label="Phone" disabled={disabled} />
            <TextField control={form.control} name="website" label="Website" disabled={disabled} />
            <TextField control={form.control} name="addressLine1" label="Address" disabled={disabled} />
            <TextField control={form.control} name="addressLine2" label="Address line 2" disabled={disabled} />
            <TextField control={form.control} name="taxId" label="Tax ID" disabled={disabled} />
          </FieldGroup>

          {showBanking ? (
            <FieldGroup className="grid gap-4 border-t pt-6 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="paymentAccountName"
                label="Payment account name"
                description="Only Full access roles can see or change the bank details."
                disabled={disabled}
              />
              <TextField control={form.control} name="routingNumber" label="Routing number" disabled={disabled} />
            </FieldGroup>
          ) : null}

          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving" : "Save changes"}
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
