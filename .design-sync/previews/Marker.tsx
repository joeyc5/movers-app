import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { MapPin, Truck } from "lucide-react";

export function Default() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Marker>
        <MarkerIcon>
          <MapPin />
        </MarkerIcon>
        <MarkerContent>Origin — 1200 Market St, San Jose</MarkerContent>
      </Marker>
      <Marker>
        <MarkerIcon>
          <Truck />
        </MarkerIcon>
        <MarkerContent>Destination — 88 Virginia St, Reno</MarkerContent>
      </Marker>
    </div>
  );
}

export function Variants() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Marker variant="border">
        <MarkerContent>Survey completed</MarkerContent>
      </Marker>
      <Marker variant="separator">
        <MarkerContent>Estimate sent</MarkerContent>
      </Marker>
    </div>
  );
}
