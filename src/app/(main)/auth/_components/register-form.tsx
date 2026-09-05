"use client";

import { useState, useTransition } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { registerAccount } from "@/server/signup-actions";

const formSchema = z.object({
  fullName: z
    .string()
    .min(2, { message: "Enter your full name." })
    .max(80, { message: "Keep it under 80 characters." }),
  email: z.email({ message: "Enter a valid email address." }),
  password: z.string().min(8, { message: "Use at least 8 characters." }),
});

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("fullName", data.fullName);
      formData.set("email", data.email);
      formData.set("password", data.password);
      // On success with confirmations off the action redirects and this
      // transition never settles; the "check your email" branch returns a value.
      const result = await registerAccount(null, formData);
      if (result && "error" in result) setServerError(result.error);
      if (result && "status" in result) setSentTo(result.email);
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-8 text-primary" />
        <div className="space-y-1">
          <p className="font-medium">Check your email</p>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to {sentTo}. Open it to finish setting up your company.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="fullName"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-name">Full name</FieldLabel>
              <Input
                {...field}
                id="register-name"
                type="text"
                placeholder="Jordan Reyes"
                autoComplete="name"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-email">Work email</FieldLabel>
              <Input
                {...field}
                id="register-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="register-password">Password</FieldLabel>
              <Input
                {...field}
                id="register-password"
                type="password"
                placeholder="At least 8 characters"
                autoComplete="new-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      {serverError && (
        <p role="alert" className="text-destructive text-sm">
          {serverError}
        </p>
      )}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link href="/auth/v1/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
