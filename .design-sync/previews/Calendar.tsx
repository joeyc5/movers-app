import { Calendar } from "@/components/ui/calendar";

export function SingleDay() {
  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 2, 1)}
      selected={new Date(2026, 2, 17)}
      className="border-border rounded-md border"
    />
  );
}

export function MoveWindow() {
  return (
    <Calendar
      mode="range"
      defaultMonth={new Date(2026, 2, 1)}
      selected={{ from: new Date(2026, 2, 16), to: new Date(2026, 2, 20) }}
      className="border-border rounded-md border"
    />
  );
}
