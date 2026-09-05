"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { updateOwnProfile } from "@/server/staff-actions";

export type ProfileView = {
  fullName: string;
  workEmail: string;
  roleName: string;
  accessLevel: string;
  team: string;
  status: string;
  avatarUrl: string | null;
  companyName: string;
};

const formSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name."),
  avatarUrl: z.union([z.url("Enter a valid image URL."), z.literal("")]),
});

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm">{value || "Not set"}</span>
    </div>
  );
}

export function ProfilePanel({ profile }: { profile: ProfileView }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: profile.fullName, avatarUrl: profile.avatarUrl ?? "" },
  });

  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl ?? "");
  const nameValue = form.watch("fullName") || profile.fullName;

  function onSubmit(data: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const result = await updateOwnProfile(data);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved.");
      form.reset(data);
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-xl leading-none">Your profile</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-14">
            {avatarPreview ? <AvatarImage src={avatarPreview} alt="" /> : null}
            <AvatarFallback className="text-base">{getInitials(nameValue || "?")}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-base">{nameValue}</span>
            <span className="truncate text-muted-foreground text-sm">{profile.workEmail}</span>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge variant="outline" className="rounded-sm">
                {profile.roleName || "No role"}
              </Badge>
              <Badge variant="outline" className="rounded-sm">
                {profile.status || "Unknown"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <ReadOnlyField label="Team" value={profile.team} />
          <ReadOnlyField label="Access level" value={profile.accessLevel} />
          <ReadOnlyField label="Company" value={profile.companyName} />
          <ReadOnlyField label="Work email" value={profile.workEmail} />
        </div>

        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 border-t pt-6">
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
                  <Input {...field} id="profile-name" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="avatarUrl"
              render={({ field, fieldState }) => (
                <Field className="gap-1.5" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-avatar">Photo URL</FieldLabel>
                  <Input
                    {...field}
                    id="profile-avatar"
                    inputMode="url"
                    placeholder="https://"
                    aria-invalid={fieldState.invalid}
                    onChange={(event) => {
                      field.onChange(event);
                      setAvatarPreview(event.target.value);
                    }}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending || !form.formState.isDirty}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            {form.formState.isDirty ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  form.reset({ fullName: profile.fullName, avatarUrl: profile.avatarUrl ?? "" });
                  setAvatarPreview(profile.avatarUrl ?? "");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
