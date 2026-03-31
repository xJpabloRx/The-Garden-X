import { createClient } from "@/lib/supabase/server";
import SellOrderClient from "@/components/SellOrderClient";
import type { Inventario } from "@/lib/types";

export default async function SellPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p className="text-dim text-center py-12">Please log in</p>;

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user.id).single();
  const clienteId = cliente?.id ?? "";

  // Load inventory
  const { data: inventario } = await supabase
    .from("inventario").select("*").eq("cliente_id", clienteId)
    .order("created_at", { ascending: false }) as { data: Inventario[] | null };

  // Load ventas + creditos to know what's consumed
  const { data: ventas } = await supabase
    .from("ventas").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
    .eq("cliente_id", clienteId);
  const { data: creditos } = await supabase
    .from("creditos").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
    .eq("cliente_id", clienteId);

  // Ship lookup
  type ShipInfo = { hawb: string; awb: string; fecha: string };
  const shipLookup: Record<string, ShipInfo> = {};

  const { data: coords } = await supabase
    .from("coordinaciones").select("id, hawb, awb, fecha_salida")
    .eq("cliente_id", clienteId);
  for (const c of (coords ?? [])) {
    shipLookup[c.id] = { hawb: c.hawb || "", awb: c.awb || "", fecha: c.fecha_salida || "" };
  }
  const { data: exps } = await supabase
    .from("exportaciones").select("id, hawb, awb, fecha")
    .eq("cliente_id", clienteId);
  for (const e of (exps ?? [])) {
    if (!shipLookup[e.id]) shipLookup[e.id] = { hawb: e.hawb || "", awb: e.awb || "", fecha: e.fecha || "" };
  }

  // Build invProductsMap directly from inventario.productos
  type BoxProduct = { tipo: string; variedad: string; cantidad: number; stem_length: string; color: string };
  const invProductsMap: Record<string, BoxProduct[]> = {};
  for (const inv of (inventario ?? [])) {
    if (Array.isArray(inv.productos) && inv.productos.length > 0) {
      invProductsMap[inv.id] = inv.productos as BoxProduct[];
    }
  }

  // Load buyers
  const { data: compradores } = await supabase
    .from("compradores").select("id, nombre").eq("cliente_id", clienteId).order("nombre");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Sell</h1>
        <p className="text-dim text-sm mt-1">Create sell orders from your inventory</p>
      </div>
      <SellOrderClient
        inventario={(inventario ?? []) as Record<string, unknown>[]}
        ventas={(ventas ?? []) as Record<string, unknown>[]}
        creditos={(creditos ?? []) as Record<string, unknown>[]}
        invProductsMap={invProductsMap as Record<string, Record<string, unknown>[]>}
        shipLookup={shipLookup}
        compradores={(compradores ?? []) as { id: string; nombre: string }[]}
        clienteId={clienteId}
      />
    </div>
  );
}
