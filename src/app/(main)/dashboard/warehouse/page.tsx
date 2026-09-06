import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStorageCustomers, getVaults, getWarehouseLocations } from "@/server/queries/warehouse";

import { StorageCustomersPanel } from "./_components/storage-customers-panel";
import { VaultsPanel } from "./_components/vaults-panel";

export default async function Page() {
  const [storageCustomers, vaults, warehouseLocations] = await Promise.all([
    getStorageCustomers(),
    getVaults(),
    getWarehouseLocations(),
  ]);
  const locations = warehouseLocations.map((location) => location.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="font-heading font-semibold text-xl tracking-tight">Warehouse</h1>
        <p className="text-muted-foreground text-sm">Storage agreements and vault capacity across locations.</p>
      </div>

      <Tabs defaultValue="storage-customers">
        <TabsList variant="line">
          <TabsTrigger value="storage-customers">Storage Customers</TabsTrigger>
          <TabsTrigger value="vaults">Vaults</TabsTrigger>
        </TabsList>

        <TabsContent className="pt-4" value="storage-customers">
          <StorageCustomersPanel storageCustomers={storageCustomers} locations={locations} />
        </TabsContent>

        <TabsContent className="pt-4" value="vaults">
          <VaultsPanel vaults={vaults} locations={locations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
