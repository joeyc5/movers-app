---
category: Forms
---

A one-time code field. Set `maxLength` to the code length and render one `InputOTPSlot` per digit, indexed from zero.

Split long codes with `InputOTPSeparator` so they read in groups.

## Parts

Composed with `InputOTPGroup`, `InputOTPSeparator`, `InputOTPSlot`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot,
} from "@/components/ui/input-otp";

export function SixDigit() {
  return (
    <InputOTP maxLength={6} value="482913">
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

export function Empty() {
  return (
    <InputOTP maxLength={4} value="">
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
        <InputOTPSlot index={3} />
      </InputOTPGroup>
    </InputOTP>
  );
}
```
