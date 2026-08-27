import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/rbac";
import { getBusinessSettings } from "@/lib/settings-server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || !user.isSuperAdmin) {
    redirect("/");
  }

  const settings = await getBusinessSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-10 py-10">
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Business Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
