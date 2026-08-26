import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { storageCustomers, vaults } from "./_components/data";
import { StorageCustomersPanel } from "./_components/storage-customers-panel";
import { VaultsPanel } from "./_components/vaults-panel";

export default function Page() {
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
          <StorageCustomersPanel storageCustomers={storageCustomers} />
        </TabsContent>

        <TabsContent className="pt-4" value="vaults">
          <VaultsPanel vaults={vaults} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
