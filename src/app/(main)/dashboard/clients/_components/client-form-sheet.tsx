"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldError as RhfFieldError, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { type ClientInput, createClientAccount, updateClientAccount } from "@/server/client-actions";
import type { AccountOwnerOption } from "@/server/queries/clients";

import type { Client } from "./data";

const UNASSIGNED = "unassigned";
const TYPES = ["Residential", "Commercial"] as const;
const STATUSES = ["Lead", "Active", "In Storage", "Past", "Inactive"] as const;

const addressGroup = z.object({
  street: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  zip: z.string().trim(),
});

function refineOptionalAddress(label: string) {
  return (address: z.infer<typeof addressGroup>, ctx: z.RefinementCtx) => {
    const values = [address.street, address.city, address.state, address.zip];
    const filled = values.filter(Boolean).length;
    if (filled > 0 && filled < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Complete every line of the ${label} address or clear it.`,
        path: ["street"],
      });
    }
  };
}

const formSchema = z.object({
  name: z.string().trim().min(1, "Enter the account name."),
  type: z.enum(TYPES),
  status: z.enum(STATUSES),
  primaryContactName: z.string().trim().min(1, "Enter the primary contact."),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().min(1, "Enter a phone number."),
  billing: z.object({
    street: z.string().trim().min(1, "Enter the billing street."),
    city: z.string().trim().min(1, "Enter the billing city."),
    state: z.string().trim().min(1, "Enter the billing state."),
    zip: z.string().trim().min(1, "Enter the billing ZIP."),
  }),
  origin: addressGroup.superRefine(refineOptionalAddress("origin")),
  destination: addressGroup.superRefine(refineOptionalAddress("destination")),
  ownerStaffId: z.string(),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters."),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_ADDRESS = { street: "", city: "", state: "", zip: "" };

function toDefaults(client?: Client): FormValues {
  return {
    name: client?.name ?? "",
    type: client?.type ?? "Residential",
    status: client?.status ?? "Lead",
    primaryContactName: client?.primaryContactName ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    billing: client?.billingAddress ?? EMPTY_ADDRESS,
    origin: client?.originAddress ?? EMPTY_ADDRESS,
    destination: client?.destinationAddress ?? EMPTY_ADDRESS,
    ownerStaffId: client?.accountOwnerId ?? UNASSIGNED,
    notes: client?.notes ?? "",
  };
}

function packAddress(address: FormValues["origin"]): ClientInput["origin"] {
  return address.street ? { ...address } : null;
}

interface ClientFormSheetProps {
  mode: "create" | "edit";
  owners: AccountOwnerOption[];
  client?: Client;
  trigger: ReactNode;
}

export function ClientFormSheet({ mode, owners, client, trigger }: ClientFormSheetProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toDefaults(client),
  });
  const { errors } = form.formState;

  // Reopen on a fresh client (edit) or a fresh open (create) starts clean.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the sheet opens
  useEffect(() => {
    if (open) form.reset(toDefaults(client));
  }, [open]);

  function onSubmit(values: FormValues) {
    const input: ClientInput = {
      name: values.name,
      type: values.type,
      status: values.status,
      primaryContactName: values.primaryContactName,
      email: values.email,
      phone: values.phone,
      billing: values.billing,
      origin: packAddress(values.origin),
      destination: packAddress(values.destination),
      ownerStaffId: values.ownerStaffId === UNASSIGNED ? null : values.ownerStaffId,
      notes: values.notes ? values.notes : null,
    };

    startTransition(async () => {
      const result =
        mode === "create" ? await createClientAccount(input) : await updateClientAccount(client?.id ?? "", input);
      // createClientAccount redirects on success and never returns.
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Client saved.");
      setOpen(false);
    });
  }

  const title = mode === "create" ? "New client" : `Edit ${client?.name ?? "client"}`;
  const submitLabel = mode === "create" ? "Add client" : "Save changes";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>Contact details, addresses, and the account owner.</SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="client-name">Account name</FieldLabel>
              <Input id="client-name" aria-invalid={!!errors.name} {...form.register("name")} />
              {errors.name && <FieldError errors={[errors.name]} />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Type"
                value={form.watch("type")}
                options={TYPES}
                onChange={(value) => form.setValue("type", value as FormValues["type"])}
              />
              <SelectField
                label="Status"
                value={form.watch("status")}
                options={STATUSES}
                onChange={(value) => form.setValue("status", value as FormValues["status"])}
              />
            </div>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="client-owner">Account owner</FieldLabel>
              <Select
                value={form.watch("ownerStaffId")}
                onValueChange={(value) => form.setValue("ownerStaffId", value)}
              >
                <SelectTrigger id="client-owner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem key={owner.id} value={owner.id}>
                        {owner.name}
                        {owner.active ? "" : " (inactive)"}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <FieldSeparator />

            <Field className="gap-1.5">
              <FieldLabel htmlFor="client-contact">Primary contact</FieldLabel>
              <Input
                id="client-contact"
                aria-invalid={!!errors.primaryContactName}
                {...form.register("primaryContactName")}
              />
              {errors.primaryContactName && <FieldError errors={[errors.primaryContactName]} />}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="client-email">Email</FieldLabel>
                <Input id="client-email" type="email" aria-invalid={!!errors.email} {...form.register("email")} />
                {errors.email && <FieldError errors={[errors.email]} />}
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="client-phone">Phone</FieldLabel>
                <Input id="client-phone" aria-invalid={!!errors.phone} {...form.register("phone")} />
                {errors.phone && <FieldError errors={[errors.phone]} />}
              </Field>
            </div>

            <FieldSeparator />

            <AddressFields legend="Billing address" prefix="billing" register={form.register} errors={errors.billing} />

            <FieldSeparator />

            <AddressFields
              legend="Origin address"
              prefix="origin"
              register={form.register}
              errors={errors.origin}
              optional
            />

            <FieldSeparator />

            <AddressFields
              legend="Destination address"
              prefix="destination"
              register={form.register}
              errors={errors.destination}
              optional
            />

            <FieldSeparator />

            <Field className="gap-1.5">
              <FieldLabel htmlFor="client-notes">Notes</FieldLabel>
              <Textarea id="client-notes" rows={3} {...form.register("notes")} />
              {errors.notes && <FieldError errors={[errors.notes]} />}
            </Field>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const id = `client-${label.toLowerCase()}`;
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

type AddressErrors = Partial<Record<"street" | "city" | "state" | "zip", RhfFieldError>> | undefined;

function AddressFields({
  legend,
  prefix,
  register,
  errors,
  optional,
}: {
  legend: string;
  prefix: "billing" | "origin" | "destination";
  register: ReturnType<typeof useForm<FormValues>>["register"];
  errors: AddressErrors;
  optional?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="font-medium text-sm">
        {legend}
        {optional ? <span className="ml-2 text-muted-foreground text-xs">Optional</span> : null}
      </legend>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${prefix}-street`}>Street</FieldLabel>
        <Input id={`${prefix}-street`} aria-invalid={!!errors?.street} {...register(`${prefix}.street`)} />
        {errors?.street && <FieldError errors={[errors.street]} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${prefix}-city`}>City</FieldLabel>
          <Input id={`${prefix}-city`} aria-invalid={!!errors?.city} {...register(`${prefix}.city`)} />
          {errors?.city && <FieldError errors={[errors.city]} />}
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${prefix}-state`}>State</FieldLabel>
          <Input id={`${prefix}-state`} aria-invalid={!!errors?.state} {...register(`${prefix}.state`)} />
          {errors?.state && <FieldError errors={[errors.state]} />}
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor={`${prefix}-zip`}>ZIP</FieldLabel>
          <Input id={`${prefix}-zip`} aria-invalid={!!errors?.zip} {...register(`${prefix}.zip`)} />
          {errors?.zip && <FieldError errors={[errors.zip]} />}
        </Field>
      </div>
    </fieldset>
  );
}
