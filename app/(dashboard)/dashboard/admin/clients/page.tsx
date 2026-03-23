import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import ClientsAdmin from "@/components/admin/ClientsAdmin";
import type { Cliente } from "@/lib/types";

export default async function AdminClientsPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Gestión de Clientes</h1>
        <p className="text-dim text-sm mt-1">Crear cuentas y gestionar acceso al portal</p>
      </div>
      <ClientsAdmin clientes={(clientes as Cliente[]) ?? []} />
    </div>
  );
}
