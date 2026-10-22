import { redirect } from "next/navigation";
import { getRoles } from "@/lib/data";

/** The home page is the first role with a full dataset (TPM for the demo). */
export default function Home() {
  const role = getRoles().find((r) => r.status === "full") ?? getRoles()[0];
  redirect(`/${role.id}`);
}
