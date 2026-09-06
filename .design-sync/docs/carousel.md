---
category: Data
---

A horizontal slider built on Embla. `CarouselContent` wraps the `CarouselItem`s; `CarouselPrevious` and `CarouselNext` render the arrows.

Every part must live inside `Carousel`, which owns the embla instance.

## Parts

Composed with `CarouselContent`, `CarouselItem`, `CarouselNext`, `CarouselPrevious`. Every part is a named export on `window.MoversCRM`.

## Examples

```tsx
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";

const rooms = ["Kitchen", "Living room", "Primary bedroom", "Garage"];

export function SurveyPhotos() {
  return (
    <Carousel className="w-full max-w-xs">
      <CarouselContent>
        {rooms.map((room) => (
          <CarouselItem key={room}>
            <div className="bg-muted text-muted-foreground flex aspect-video items-center justify-center rounded-md text-sm">
              {room}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
```
