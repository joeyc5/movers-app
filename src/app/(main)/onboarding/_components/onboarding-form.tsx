"use client";

import { useRef, useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCompany } from "@/server/signup-actions";

const formSchema = z.object({
  name: z.string().min(2, { message: "Enter a company name." }).max(80, { message: "Keep it under 80 characters." }),
  slug: z
    .string()
    .min(3, { message: "Use 3 to 40 characters." })
    .max(40, { message: "Use 3 to 40 characters." })
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "Lowercase letters, numbers, and single hyphens only." }),
});

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function OnboardingForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const slugEdited = useRef(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    setServerError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("slug", data.slug);
      // On success the action redirects to the dashboard and this transition
      // never settles; only the failure path returns a value.
      const result = await createCompany(null, formData);
      if (result?.error) setServerError(result.error);
    });
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FieldGroup className="gap-4">
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="company-name">Company name</FieldLabel>
              <Input
                {...field}
                id="company-name"
                type="text"
                placeholder="Bay Area Movers"
                autoComplete="organization"
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  field.onChange(event);
                  if (!slugEdited.current) {
                    form.setValue("slug", toSlug(event.target.value), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                  }
                }}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field className="gap-1.5" data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="company-slug">Company URL</FieldLabel>
              <Input
                {...field}
                id="company-slug"
                type="text"
                placeholder="bay-area-movers"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={fieldState.invalid}
                onChange={(event) => {
                  slugEdited.current = true;
                  field.onChange(event);
                }}
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
        {pending ? "Creating company…" : "Create company"}
      </Button>
    </form>
  );
}
