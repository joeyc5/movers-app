import { DateRangePicker } from "@/components/date-range-picker";

export function Default() {
  return (
    <div className="w-full max-w-sm">
      <DateRangePicker
        value={{ from: new Date(2026, 2, 16), to: new Date(2026, 2, 20) }}
      />
    </div>
  );
}
