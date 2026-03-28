import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLive } from "../../components/dashboard-live";
import { getDashboardDataForUser } from "../../lib/dashboard-fetch";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const initialData = await getDashboardDataForUser(userId);
  return <DashboardLive initialData={initialData} />;
}
