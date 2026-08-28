import { Lock } from "lucide-react";

import { signOut } from "@/server/auth-actions";

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

const REASON_COPY: Record<string, string> = {
  "no-membership":
    "This account has no active membership in any company. Contact an administrator if you believe this is an error.",
  "revoked-selection":
    "Your access to this company has been revoked. Contact an administrator if you believe this is an error.",
};

const DEFAULT_COPY =
  "This account is not linked to a staff record. Contact an administrator if you believe this is an error.";

/**
 * Reached when a signed-in account cannot enter the dashboard: no linked
 * staff row, no active company membership anywhere, or the company they
 * had selected no longer has them as active staff. Linking back into the
 * dashboard would loop straight back here, so the only exit offered is
 * signing out to try another account.
 */
export default async function page({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const message = (reason && REASON_COPY[reason]) || DEFAULT_COPY;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <Lock className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 font-bold text-3xl tracking-tight sm:text-4xl">Unauthorized Access</h1>
        <p className="mt-4 text-muted-foreground">{message}</p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-xs transition-colors hover:bg-primary/90 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Sign in as a different user
          </button>
        </form>
      </div>
    </div>
  );
}
