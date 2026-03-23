import { createClient } from "@/lib/supabase/server";
import VarietiesAdmin from "@/components/admin/VarietiesAdmin";
import type { Variedad } from "@/lib/types";

export default async function AdminVarietiesPage() {
  const supabase = await createClient();
  const { data: variedades } = await supabase
    .from("variedades").select("*").order("nombre");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Variedades</h1>
        <p className="text-dim text-sm mt-1">Gestiona las variedades disponibles para pedidos</p>
      </div>
      <VarietiesAdmin variedades={(variedades as Variedad[]) ?? []} />
    </div>
  );
}
