"use client";

import { useEffect, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { MoreHorizontal } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { STAFF_TEAMS, setStaffRole, setStaffStatus, updateStaff } from "@/server/staff-actions";

import type { UserRow } from "./data";

const editSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email."),
  team: z.enum(STAFF_TEAMS),
});

type EditValues = z.infer<typeof editSchema>;

export interface UserActionsContext {
  roleOptions: { slug: string; name: string }[];
  canManageUsers: boolean;
  /** The signed-in staff row, so nobody can deactivate or demote themselves. */
  currentStaffId: string | null;
}

export function UserActions({ user, ctx }: { user: UserRow; ctx: UserActionsContext }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const isSelf = ctx.currentStaffId === user.id;
  const isDeactivated = user.status === "Deactivated";

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: user.name, email: user.email, team: user.team },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the sheet opens
  useEffect(() => {
    if (editing) form.reset({ fullName: user.name, email: user.email, team: user.team });
  }, [editing]);

  function run(work: () => Promise<{ error?: string }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      setEditing(false);
    });
  }

  if (!ctx.canManageUsers) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Open actions for ${user.name}`}
            className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setEditing(true)}>Edit user</DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={isSelf}>Change role</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuLabel>Role</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={user.roleSlug}
                onValueChange={(roleSlug) =>
                  run(() => setStaffRole({ staffId: user.id, roleSlug }), `${user.name} is now ${roleSlug}.`)
                }
              >
                {ctx.roleOptions.map((role) => (
                  <DropdownMenuRadioItem key={role.slug} value={role.slug}>
                    {role.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {isDeactivated ? (
            <DropdownMenuItem
              disabled={pending}
              onSelect={() =>
                run(() => setStaffStatus({ staffId: user.id, status: "Active" }), `${user.name} was reactivated.`)
              }
            >
              Reactivate user
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending || isSelf}
              onSelect={() =>
                run(() => setStaffStatus({ staffId: user.id, status: "Deactivated" }), `${user.name} was deactivated.`)
              }
            >
              Deactivate user
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit user</SheetTitle>
            <SheetDescription>Role and status are changed from the row menu.</SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col gap-4 px-4"
            noValidate
            onSubmit={form.handleSubmit((values) =>
              run(() => updateStaff({ staffId: user.id, ...values }), "Changes saved."),
            )}
          >
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="fullName"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="edit-user-name">Full name</FieldLabel>
                    <Input {...field} id="edit-user-name" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="edit-user-email">Work email</FieldLabel>
                    <Input {...field} id="edit-user-email" type="email" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="team"
                render={({ field }) => (
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="edit-user-team">Team</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-user-team">
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
                  </Field>
                )}
              />
            </FieldGroup>

            <SheetFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving" : "Save changes"}
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
    </>
  );
}
