import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SeoOfficeLive } from "../../components/seo-office-live";
import { getDashboardDataForUser } from "../../lib/dashboard-fetch";

export default async function SeoOfficePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/");
  }

  const initialData = await getDashboardDataForUser(userId);
  return <SeoOfficeLive initialData={initialData} />;
}
