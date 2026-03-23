import { createClient } from "@/lib/supabase/server";
import OrdersAdmin from "@/components/admin/OrdersAdmin";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const [{ data: ordenes }, { data: clientes }] = await Promise.all([
    supabase.from("ordenes").select("*, orden_items(*)").order("created_at", { ascending: false }),
    supabase.from("clientes").select("id, nombre, empresa"),
  ]);

  // Build client lookup
  const clientMap: Record<string, string> = {};
  for (const c of clientes ?? []) {
    clientMap[c.id] = c.empresa ? `${c.nombre} (${c.empresa})` : c.nombre;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Orders Management</h1>
        <p className="text-dim text-sm mt-1">Review, confirm, and manage client orders</p>
      </div>
      <OrdersAdmin ordenes={ordenes ?? []} clientMap={clientMap} />
    </div>
  );
}
