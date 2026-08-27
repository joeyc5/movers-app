import { redirect } from "next/navigation";

/** `/dashboard` has no content of its own; the overview lives at `/dashboard/default`. */
export default function Page() {
  redirect("/dashboard/default");
}
