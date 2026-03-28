import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SettingsIntegrations } from "../../components/settings-integrations";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  return <SettingsIntegrations />;
}
