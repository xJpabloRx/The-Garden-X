import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import OrderForm from "@/components/OrderForm";
import OrderList from "@/components/OrderList";
import type { Orden, Variedad } from "@/lib/types";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user!.id).single();

  const [{ data: ordenes }, { data: variedades }] = await Promise.all([
    supabase.from("ordenes").select("*, orden_items(*)").eq("cliente_id", cliente?.id).order("created_at", { ascending: false }),
    supabase.from("variedades").select("*").eq("activo", true).order("nombre"),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Orders</h1>
        <p className="text-dim text-sm mt-1">Reserve flowers and manage your orders</p>
      </div>

      <OrderForm clienteId={cliente?.id ?? ""} variedades={(variedades as Variedad[]) ?? []} />

      <Card>
        <CardHeader><CardTitle>My Orders</CardTitle></CardHeader>
        <OrderList ordenes={(ordenes as Orden[]) ?? []} />
      </Card>
    </div>
  );
}
