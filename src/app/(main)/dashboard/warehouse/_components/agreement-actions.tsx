"use client";
import * as React from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal, Plus } from "lucide-react";
import { type Control, Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { Client } from "@/app/(main)/dashboard/clients/_components/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StorageCustomerRow, WarehouseLocationRow } from "@/server/queries/warehouse";
import { createAgreement, setAgreementStatus, updateAgreement } from "@/server/warehouse-actions";

import { storageStatusOptions } from "./data";

const detailSchema = z
  .object({
    status: z.enum(["Active", "Pending Move-In", "Past Due", "Move-Out Scheduled", "Closed"]),
    warehouseLocationId: z.string().min(1, "Choose a location."),
    // The form holds this as text: defaults arrive as String(row.monthlyRate)
    // and submit reads Number(values.monthlyRate). z.coerce.number() typed the
    // field as unknown, which no input can bind to.
    monthlyRate: z
      .string()
      .refine((v) => v.trim() !== "" && Number.isFinite(Number(v)), "Enter a rate.")
      .refine((v) => Number(v) >= 0, "Rate cannot be negative."),
    moveInDate: z.string().min(1, "Move-in date is required."),
    nextBillingDate: z.string(),
  })
  .refine((v) => v.status !== "Closed" || v.nextBillingDate === "", {
    message: "Clear the next billing date before closing.",
    path: ["nextBillingDate"],
  })
  .refine((v) => v.nextBillingDate === "" || v.nextBillingDate >= v.moveInDate, {
    message: "The next billing date cannot fall before move-in.",
    path: ["nextBillingDate"],
  });

type DetailValues = z.input<typeof detailSchema>;

function AgreementFields({
  control,
  locations,
  idPrefix,
}: {
  control: Control<DetailValues>;
  locations: WarehouseLocationRow[];
  idPrefix: string;
}) {
  return (
    <FieldGroup className="gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="status"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-status`}>Status</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-status`} aria-invalid={fieldState.invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {storageStatusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Controller
          control={control}
          name="warehouseLocationId"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-location`}>Location</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${idPrefix}-location`} aria-invalid={fieldState.invalid}>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
      <Controller
        control={control}
        name="monthlyRate"
        render={({ field, fieldState }) => (
          <Field className="gap-1.5" data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-rate`}>Monthly rate</FieldLabel>
            <Input
              {...field}
              id={`${idPrefix}-rate`}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="moveInDate"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-movein`}>Move-in date</FieldLabel>
              <Input {...field} id={`${idPrefix}-movein`} type="date" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="nextBillingDate"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${idPrefix}-billing`}>Next billing date</FieldLabel>
              <Input {...field} id={`${idPrefix}-billing`} type="date" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>
    </FieldGroup>
  );
}

export function StorageRowActions({
  row,
  locations,
  canManage,
}: {
  row: StorageCustomerRow;
  locations: WarehouseLocationRow[];
  canManage: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);

  const form = useForm<DetailValues>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      status: row.status,
      warehouseLocationId: row.warehouseLocationId,
      monthlyRate: String(row.monthlyRate),
      moveInDate: row.moveInDate,
      nextBillingDate: row.nextBillingDate ?? "",
    },
  });

  React.useEffect(() => {
    if (editOpen) {
      form.reset({
        status: row.status,
        warehouseLocationId: row.warehouseLocationId,
        monthlyRate: String(row.monthlyRate),
        moveInDate: row.moveInDate,
        nextBillingDate: row.nextBillingDate ?? "",
      });
    }
  }, [editOpen, row, form]);

  function run(action: () => Promise<{ error?: string } | undefined>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      onDone?.();
    });
  }

  function onEditSubmit(values: DetailValues) {
    run(
      () =>
        updateAgreement(row.id, {
          status: values.status,
          warehouseLocationId: values.warehouseLocationId,
          monthlyRate: Number(values.monthlyRate),
          moveInDate: values.moveInDate,
          nextBillingDate: values.nextBillingDate === "" ? null : values.nextBillingDate,
        }),
      () => {
        toast.success(`${row.id} updated.`);
        setEditOpen(false);
      },
    );
  }

  return (
    <div className="text-right">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open actions for ${row.customerName}`}
            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`/dashboard/clients/${row.clientCode}`}>View client</a>
          </DropdownMenuItem>
          {canManage ? (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={row.status}
                    onValueChange={(next) =>
                      run(
                        () => setAgreementStatus(row.id, next),
                        () => toast.success(`${row.id} set to ${next}.`),
                      )
                    }
                  >
                    {storageStatusOptions
                      .filter((option) => option !== "Closed")
                      .map((option) => (
                        <DropdownMenuRadioItem key={option} value={option} disabled={pending}>
                          {option}
                        </DropdownMenuRadioItem>
                      ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={(event) => (event.preventDefault(), setEditOpen(true))}>
                Edit agreement
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={row.status === "Closed"}
                onSelect={(event) => (event.preventDefault(), setCloseOpen(true))}
              >
                Close agreement
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <form noValidate onSubmit={form.handleSubmit(onEditSubmit)}>
            <DialogHeader>
              <DialogTitle>Edit {row.id}</DialogTitle>
              <DialogDescription>{row.customerName}</DialogDescription>
            </DialogHeader>
            <div className="py-4 text-left">
              <AgreementFields control={form.control} locations={locations} idPrefix={`edit-${row.id}`} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {row.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing releases the agreement&apos;s vaults and stops billing. It stays on record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() =>
                run(
                  () => setAgreementStatus(row.id, "Closed"),
                  () => {
                    toast.success(`${row.id} closed.`);
                    setCloseOpen(false);
                  },
                )
              }
            >
              Close agreement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const createSchema = detailSchema.safeExtend({
  clientCode: z.string().min(1, "Choose a customer."),
});

type CreateValues = z.input<typeof createSchema>;

export function NewAgreementButton({ locations, clients }: { locations: WarehouseLocationRow[]; clients: Client[] }) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      clientCode: "",
      status: "Active",
      warehouseLocationId: "",
      monthlyRate: "0",
      moveInDate: "",
      nextBillingDate: "",
    },
  });

  function onSubmit(values: CreateValues) {
    startTransition(async () => {
      const result = await createAgreement({
        clientCode: values.clientCode,
        status: values.status,
        warehouseLocationId: values.warehouseLocationId,
        monthlyRate: Number(values.monthlyRate),
        moveInDate: values.moveInDate,
        nextBillingDate: values.nextBillingDate === "" ? null : values.nextBillingDate,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Storage agreement created.");
      setOpen(false);
      form.reset();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New Agreement
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New storage agreement</DialogTitle>
            <DialogDescription>The agreement number is issued on save.</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-left">
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="clientCode"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="new-agreement-client">Customer</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="new-agreement-client" aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              {/* CreateValues is DetailValues plus clientCode, so every field this
                  component touches is present; Control is not covariant, hence the cast. */}
              <AgreementFields
                control={form.control as unknown as Control<DetailValues>}
                locations={locations}
                idPrefix="new-agreement"
              />
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create agreement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
