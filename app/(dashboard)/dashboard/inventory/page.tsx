import { createClient } from "@/lib/supabase/server";
import InventoryClient from "@/components/InventoryClient";
import type { Inventario } from "@/lib/types";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user!.id).single();
  const clienteId = cliente?.id ?? "";

  const { data: inventario } = await supabase
    .from("inventario")
    .select("*, inventario_items(*)")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false }) as { data: Inventario[] | null };

  // Shipment info lookup — keyed by coord id, export id, AND qr_token
  type ShipInfo = { hawb: string; awb: string; fecha: string; variedad: string; origen: string; destino: string };
  const shipLookup: Record<string, ShipInfo> = {};

  const { data: coords } = await supabase
    .from("coordinaciones")
    .select("id, hawb, awb, fecha_salida, variedad, origen, destino, export_id, qr_token")
    .eq("cliente_id", clienteId);
  for (const c of (coords ?? [])) {
    const info: ShipInfo = { hawb: c.hawb||"", awb: c.awb||"", fecha: c.fecha_salida||"", variedad: c.variedad||"", origen: c.origen||"", destino: c.destino||"" };
    shipLookup[c.id] = info;
    if (c.qr_token) shipLookup[`qr:${c.qr_token}`] = info;
    if (c.export_id) shipLookup[`exp:${c.export_id}`] = info;
  }

  const { data: exps } = await supabase
    .from("exportaciones")
    .select("id, hawb, awb, fecha, variedad, origen, destino, qr_token, export_id")
    .eq("cliente_id", clienteId);
  for (const e of (exps ?? [])) {
    const info: ShipInfo = { hawb: e.hawb||"", awb: e.awb||"", fecha: e.fecha||"", variedad: e.variedad||"", origen: e.origen||"", destino: e.destino||"" };
    if (!shipLookup[e.id]) shipLookup[e.id] = info;
    if (e.qr_token && !shipLookup[`qr:${e.qr_token}`]) shipLookup[`qr:${e.qr_token}`] = info;
    if (e.export_id && !shipLookup[`exp:${e.export_id}`]) shipLookup[`exp:${e.export_id}`] = info;
  }

  // Build invProductsMap directly from inventario.productos (stored at move-to-inventory time)
  type BoxProducts = { tipo: string; variedad: string; cantidad: number; stem_length: string; color: string }[];
  const invProductsMap: Record<string, BoxProducts> = {};
  for (const inv of (inventario ?? [])) {
    if (Array.isArray(inv.productos) && inv.productos.length > 0) {
      invProductsMap[inv.id] = inv.productos as BoxProducts;
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Inventory</h1>
        <p className="text-dim text-sm mt-1">Stock, boxes and sell tracking</p>
      </div>
      <InventoryClient
        inventario={inventario ?? []}
        clienteId={clienteId}
        shipLookup={shipLookup}
        invProductsMap={invProductsMap}
      />
    </div>
  );
}
