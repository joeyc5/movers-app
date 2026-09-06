"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { inviteStaff, STAFF_TEAMS } from "@/server/staff-actions";

// Mirrors inviteSchema in staff-actions so the form refuses what the action
// would. admin_invite_staff creates the staff row at 'Pending invite'; the
// person claims it on their first sign-in.
const formSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email."),
  roleSlug: z.string().trim().min(1, "Choose a role."),
  team: z.enum(STAFF_TEAMS),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY: FormValues = { fullName: "", email: "", roleSlug: "", team: "Dispatch" };

export function InviteUserSheet({
  roleOptions,
  trigger,
}: {
  roleOptions: { slug: string; name: string }[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the sheet opens
  useEffect(() => {
    if (open) form.reset(EMPTY);
  }, [open]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await inviteStaff(values);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${values.fullName} was invited.`);
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite a user</SheetTitle>
          <SheetDescription>
            They join as Pending invite and become Active when they first sign in with this email.
          </SheetDescription>
        </SheetHeader>

        <form className="flex flex-1 flex-col gap-4 px-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-name">Full name</FieldLabel>
                  <Input {...field} id="invite-name" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-email">Work email</FieldLabel>
                  <Input {...field} id="invite-email" type="email" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="roleSlug"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="invite-role" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.slug} value={role.slug}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="team"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="invite-team">Team</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="invite-team">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_TEAMS.map((team) => (
                        <SelectItem key={team} value={team}>
                          {team}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Inviting" : "Send invite"}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
