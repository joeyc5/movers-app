import {
  Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel,
  FieldLegend, FieldSeparator, FieldSet, FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function FormSection() {
  return (
    <FieldSet className="w-full max-w-md">
      <FieldLegend>Origin</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="f-street">Street address</FieldLabel>
          <Input id="f-street" defaultValue="1200 Market St" />
          <FieldDescription>Include unit or suite if there is one.</FieldDescription>
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel htmlFor="f-zip">ZIP</FieldLabel>
          <Input id="f-zip" aria-invalid defaultValue="9511" />
          <FieldError errors={[{ message: "Enter a five-digit ZIP code." }]} />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

export function Horizontal() {
  return (
    <Field orientation="horizontal" className="w-full max-w-md">
      <FieldContent>
        <FieldTitle>Require signature on delivery</FieldTitle>
        <FieldDescription>The driver collects a signature in the app.</FieldDescription>
      </FieldContent>
      <Switch defaultChecked />
    </Field>
  );
}
