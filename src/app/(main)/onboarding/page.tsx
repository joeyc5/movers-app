import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentCompany, requireAuth } from "@/lib/supabase/auth";

import { OnboardingForm } from "./_components/onboarding-form";

/**
 * First run for a self-serve owner: signed in, but not yet attached to any
 * company. An owner who already resolves to a company has nothing to do here,
 * so send them to the dashboard. The dashboard layout routes the inverse case
 * (no membership) back to this page, so the two never strand a caller between.
 */
export default async function OnboardingPage() {
  await requireAuth();

  const company = await getCurrentCompany();
  if (company?.state === "ok") {
    redirect("/dashboard/default");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Name your company</CardTitle>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
