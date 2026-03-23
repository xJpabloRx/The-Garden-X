import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Admin = has a record in the admins table OR no client record (first-time admin)
  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isAdmin = !!adminRow;

  return (
    <div className="flex min-h-screen">
      <Sidebar cliente={cliente} userEmail={user.email ?? ""} isAdmin={isAdmin} />
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 p-4 sm:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
