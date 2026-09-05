import { Button } from "@/components/ui/button";
import {
  Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter,
  DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";

export function CrewSheet() {
  return (
    <Drawer defaultOpen modal={false}>
      <DrawerTrigger asChild>
        <Button variant="outline">Assign crew</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Assign crew</DrawerTitle>
          <DrawerDescription>Tuesday, four movers available.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button>Assign crew A</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
