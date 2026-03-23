import { createClient } from "@/lib/supabase/server";
import SalesClient from "@/components/SalesClient";

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p className="text-dim text-center py-12">Please log in</p>;

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user.id).single();
  const clienteId = cliente?.id ?? "";

  let ventas: Record<string, unknown>[] = [];
  let creditosData: Record<string, unknown>[] = [];
  if (clienteId) {
    const { data, error } = await supabase
      .from("ventas").select("*").eq("cliente_id", clienteId)
      .order("fecha_venta", { ascending: false });
    if (!error && data) ventas = data;
    if (error) console.error("Sales query error:", error.message);

    const { data: creds, error: credErr } = await supabase
      .from("creditos").select("*").eq("cliente_id", clienteId)
      .order("fecha_credito", { ascending: false });
    if (!credErr && creds) creditosData = creds;
    if (credErr) console.error("Credits query error:", credErr.message);
  }

  // Build inventario_id → shipment info lookup
  type ShipDetail = { cajaNum: number; hawb: string; awb: string; fecha: string };
  const shipMap: Record<string, ShipDetail> = {};

  if (clienteId) {
    const { data: invRows } = await supabase
      .from("inventario").select("id, caja_numero, coordinacion_id")
      .eq("cliente_id", clienteId);

    const coordIds = [...new Set((invRows ?? []).map(i => i.coordinacion_id).filter(Boolean))];

    // Lookup from coordinaciones
    const coordMap: Record<string, { hawb: string; awb: string; fecha: string }> = {};
    if (coordIds.length > 0) {
      const { data: coords } = await supabase
        .from("coordinaciones").select("id, hawb, awb, fecha_salida").in("id", coordIds);
      for (const c of (coords ?? [])) {
        coordMap[c.id] = { hawb: c.hawb || "", awb: c.awb || "", fecha: c.fecha_salida || "" };
      }
    }
    // Also from exportaciones (coordinacion_id might be an export id)
    const missingIds = coordIds.filter(id => !coordMap[id]);
    if (missingIds.length > 0) {
      const { data: exps } = await supabase
        .from("exportaciones").select("id, hawb, awb, fecha").in("id", missingIds);
      for (const e of (exps ?? [])) {
        if (!coordMap[e.id]) coordMap[e.id] = { hawb: e.hawb || "", awb: e.awb || "", fecha: e.fecha || "" };
      }
    }

    // Fallback: load ALL exportaciones for this client to match orphan inventario
    const { data: allExps } = await supabase
      .from("exportaciones").select("id, hawb, awb, fecha, cajas")
      .eq("cliente_id", clienteId);

    // Build export box lookup: cajaNum → export ship info
    type ExpBoxInfo = { hawb: string; awb: string; fecha: string };
    const expBoxMap = new Map<number, ExpBoxInfo>();
    for (const e of (allExps ?? [])) {
      let cajas = e.cajas;
      if (typeof cajas === "string") try { cajas = JSON.parse(cajas); } catch { cajas = []; }
      if (Array.isArray(cajas)) {
        for (const box of cajas) {
          const num = Number(box.caja);
          if (num && !expBoxMap.has(num)) {
            expBoxMap.set(num, { hawb: e.hawb || "", awb: e.awb || "", fecha: e.fecha || "" });
          }
        }
      }
    }

    for (const inv of (invRows ?? [])) {
      const coord = inv.coordinacion_id ? coordMap[inv.coordinacion_id] : null;
      // Fallback for null coordinacion_id: match by caja_numero in exportaciones
      const fallback = !coord && inv.caja_numero ? expBoxMap.get(inv.caja_numero) : null;
      const info = coord || fallback;
      shipMap[inv.id] = {
        cajaNum: inv.caja_numero ?? 0,
        hawb: info?.hawb || "—",
        awb: info?.awb || "—",
        fecha: info?.fecha || "—",
      };
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Sales</h1>
        <p className="text-dim text-sm mt-1">Track all your sales, payments and returns</p>
      </div>
      <SalesClient initialVentas={ventas} initialCreditos={creditosData} clienteId={clienteId} shipMap={shipMap} />
    </div>
  );
}
