import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esAdmin } from "@/lib/rol";

/** Todas las pantallas de /dashboard/admin: solo admins (comprobado en el servidor, no con una cookie). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await esAdmin(supabase, user.id))) redirect("/dashboard");
  return <>{children}</>;
}
