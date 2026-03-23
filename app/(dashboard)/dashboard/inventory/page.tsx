import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
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

  // Shipment info lookup
  type ShipInfo = { hawb: string; awb: string; fecha: string; variedad: string; origen: string; destino: string };
  const shipLookup: Record<string, ShipInfo> = {};

  const { data: coords } = await supabase
    .from("coordinaciones")
    .select("id, hawb, awb, fecha_salida, variedad, origen, destino, cajas, export_id")
    .eq("cliente_id", clienteId);
  for (const c of (coords ?? [])) {
    shipLookup[c.id] = { hawb: c.hawb||"", awb: c.awb||"", fecha: c.fecha_salida||"", variedad: c.variedad||"", origen: c.origen||"", destino: c.destino||"" };
  }

  const { data: exps } = await supabase
    .from("exportaciones")
    .select("id, hawb, awb, fecha, variedad, origen, destino, cajas")
    .eq("cliente_id", clienteId);

  // Build box-level product details from cajas jsonb
  // Key format: "sourceId|cajaNum" — we store under BOTH exportacion id AND coordinacion id
  type BoxProducts = { tipo: string; variedad: string; cantidad: number; stem_length: string; color: string }[];
  const boxProductsMap: Record<string, BoxProducts> = {};

  // Build coord→export mapping so we can cross-reference
  const coordExportMap: Record<string, string> = {}; // coordId → exportId
  for (const c of (coords ?? [])) {
    if (c.export_id) coordExportMap[c.id] = c.export_id;
  }

  for (const e of (exps ?? [])) {
    if (!shipLookup[e.id]) {
      shipLookup[e.id] = { hawb: e.hawb||"", awb: e.awb||"", fecha: e.fecha||"", variedad: e.variedad||"", origen: e.origen||"", destino: e.destino||"" };
    }
    let cajas = e.cajas;
    if (typeof cajas === "string") try { cajas = JSON.parse(cajas); } catch { cajas = []; }
    if (Array.isArray(cajas)) {
      for (const box of cajas) {
        const prods = Array.isArray(box.productos) ? box.productos : [];
        if (prods.length > 0) {
          boxProductsMap[`${e.id}|${box.caja}`] = prods as BoxProducts;
        }
      }
    }
  }

  for (const c of (coords ?? [])) {
    let cajas = c.cajas;
    if (typeof cajas === "string") try { cajas = JSON.parse(cajas); } catch { cajas = []; }
    if (Array.isArray(cajas)) {
      for (const box of cajas) {
        const prods = Array.isArray(box.productos) ? box.productos : [];
        if (prods.length > 0) {
          boxProductsMap[`${c.id}|${box.caja}`] = prods as BoxProducts;
        }
      }
    }
  }

  // Now map inventory records to their products
  // inventario.coordinacion_id can be a coord id, an export id, or null
  // We build a direct map: inventarioId → BoxProducts
  const invProductsMap: Record<string, BoxProducts> = {};
  for (const inv of (inventario ?? [])) {
    const cid = inv.coordinacion_id || "";
    const caja = inv.caja_numero ?? 0;
    // Try direct match (coord id or export id)
    let prods = boxProductsMap[`${cid}|${caja}`];
    // If not found and cid is a coord, try its linked export id
    if (!prods && cid && coordExportMap[cid]) {
      prods = boxProductsMap[`${coordExportMap[cid]}|${caja}`];
    }
    // If not found and cid is empty, try all export ids for this client
    if (!prods && !cid) {
      for (const e of (exps ?? [])) {
        const candidate = boxProductsMap[`${e.id}|${caja}`];
        if (candidate) { prods = candidate; break; }
      }
    }
    if (prods) invProductsMap[inv.id] = prods;
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
