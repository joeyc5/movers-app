import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ClientNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">Client not found.</h1>
      <p className="text-muted-foreground">This client doesn't exist or may have been archived.</p>
      <Link href="/dashboard/clients">
        <Button variant="outline">Back to Clients</Button>
      </Link>
    </div>
  );
}
