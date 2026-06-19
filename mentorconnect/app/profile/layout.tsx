import { AppShell } from "@/components/workspace/app-shell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const HIGHEST_ADMIN_ROLE_ID = 7;

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Only show the Admin Panel sidebar link if the user actually has admin role
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("role_id", HIGHEST_ADMIN_ROLE_ID)
    .eq("is_active", true)
    .maybeSingle();

  return (
    <AppShell userEmail={user.email} showAdmin={Boolean(adminRole)}>
      {children}
    </AppShell>
  );
}
