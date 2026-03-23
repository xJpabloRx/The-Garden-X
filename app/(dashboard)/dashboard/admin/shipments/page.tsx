import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ShipmentsAdmin from "@/components/admin/ShipmentsAdmin";
import type { Cliente } from "@/lib/types";

export default async function AdminShipmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: adminRow } = await supabase
    .from("admins").select("id").eq("user_id", user.id).single();
  if (!adminRow) redirect("/dashboard");

  const { data: clientes } = await supabase
    .from("clientes").select("id, nombre, empresa").order("nombre");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Shipments Manager</h1>
        <p className="text-dim text-sm mt-1">View, filter and edit all export shipments</p>
      </div>
      <ShipmentsAdmin clientes={(clientes as Pick<Cliente, "id" | "nombre" | "empresa">[]) ?? []} />
    </div>
  );
}
