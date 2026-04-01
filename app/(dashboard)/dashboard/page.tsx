import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import CoordinacionesClient from "@/components/CoordinacionesClient";
import type { Coordinacion } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cliente } = await supabase
    .from("clientes").select("id, empresa, nombre").eq("user_id", user!.id).single();

  const clienteId = cliente?.id ?? "";
  const empresa = cliente?.empresa ?? "";
  const nombre = cliente?.nombre ?? "";

  // Fetch coordinaciones by cliente_id
  const { data: coords } = await supabase
    .from("coordinaciones")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  // Also fetch by empresa/nombre match (for shipments not yet linked)
  let extraCoords: Coordinacion[] = [];
  if (empresa) {
    const { data: byName } = await supabase
      .from("coordinaciones")
      .select("*")
      .is("cliente_id", null)
      .ilike("cliente_nombre", empresa)
      .order("created_at", { ascending: false });
    if (byName) extraCoords = byName as Coordinacion[];
  }

  const coordIds = new Set((coords ?? []).map(c => c.id));
  let coordinaciones: Coordinacion[] = [
    ...((coords as Coordinacion[]) ?? []),
    ...extraCoords.filter(c => !coordIds.has(c.id)),
  ];

  // Fetch exportaciones to merge status/dates (admin updates exportaciones directly)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allExps: any[] = [];
  {
    const { data: byId } = await supabase
      .from("exportaciones").select("*").eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (byId) allExps = byId;
    if (allExps.length === 0 && empresa) {
      const { data: byName } = await supabase
        .from("exportaciones").select("*").is("cliente_id", null).ilike("cliente", empresa)
        .order("created_at", { ascending: false });
      if (byName) allExps = byName;
    }
  }

  // Build export lookup by hawb+fecha for merging
  const expByKey = new Map<string, { estado: string; fecha_estimada_miami?: string; fecha_confirmada_miami?: string }>();
  for (const e of allExps) {
    const key = `${e.hawb}|${e.fecha}`;
    if (e.estado && e.estado !== "coordinado") expByKey.set(key, { estado: e.estado, fecha_estimada_miami: e.fecha_estimada_miami, fecha_confirmada_miami: e.fecha_confirmada_miami });
    else if (!expByKey.has(key) && (e.fecha_estimada_miami || e.fecha_confirmada_miami)) expByKey.set(key, { estado: e.estado || "coordinado", fecha_estimada_miami: e.fecha_estimada_miami, fecha_confirmada_miami: e.fecha_confirmada_miami });
  }

  // Merge exportaciones status/dates into coordinaciones
  coordinaciones = coordinaciones.map(c => {
    const key = `${c.hawb}|${c.fecha_salida}`;
    const exp = expByKey.get(key);
    if (exp) {
      return {
        ...c,
        estado: (exp.estado || c.estado) as Coordinacion["estado"],
        fecha_estimada_miami: exp.fecha_estimada_miami || c.fecha_estimada_miami,
        fecha_confirmada_miami: exp.fecha_confirmada_miami || c.fecha_confirmada_miami,
      } as Coordinacion;
    }
    return c;
  });

  // If no coordinaciones at all, build from exportaciones (fallback)
  if (coordinaciones.length === 0 && allExps.length > 0) {
    const exps = allExps;
    // Group by fecha+hawb+awb to create virtual coordinaciones
    const grouped = new Map<string, Coordinacion>();
      for (const e of exps) {
        const key = `${e.fecha}|${e.hawb}|${e.awb}`;
        if (!grouped.has(key)) {
          // Parse cajas
          let cajas = e.cajas;
          if (typeof cajas === "string") try { cajas = JSON.parse(cajas); } catch { cajas = []; }

          grouped.set(key, {
            id: e.id,
            cliente_id: e.cliente_id,
            cliente_nombre: e.cliente || "",
            hawb: e.hawb,
            awb: e.awb,
            origen: e.origen,
            destino: e.destino,
            pais: e.pais,
            dae: e.dae,
            hbs: Array.isArray(cajas) ? cajas.length : 0,
            variedad: e.variedad,
            fecha_salida: e.fecha,
            fecha_estimada_miami: e.fecha_estimada_miami || undefined,
            fecha_confirmada_miami: e.fecha_confirmada_miami || undefined,
            estado: e.estado || "coordinado",
            qr_token: e.qr_token,
            export_id: e.export_id,
            productos: [],
            cajas: Array.isArray(cajas) ? cajas : [],
            inventario_creado: !!e.inventario_creado,
            created_at: e.created_at,
          });
        } else {
          // Merge cajas from additional exportaciones with same group
          const existing = grouped.get(key)!;
          let newCajas = e.cajas;
          if (typeof newCajas === "string") try { newCajas = JSON.parse(newCajas); } catch { newCajas = []; }
          if (Array.isArray(newCajas)) {
            existing.cajas = [...existing.cajas, ...newCajas];
            existing.hbs = existing.cajas.length;
          }
        }
      }
      coordinaciones = Array.from(grouped.values());
      // Sort cajas within each coordinacion by box number
      for (const coord of coordinaciones) {
        coord.cajas.sort((a, b) => Number(a.caja) - Number(b.caja));
      }
  }

  const stats = {
    transito:   coordinaciones.filter(c => c.estado === "en_transito" || c.estado === "coordinado").length,
    entregadas: coordinaciones.filter(c => c.estado === "entregado").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Shipments</h1>
        <p className="text-dim text-sm mt-1">Export history and shipment status</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "In Transit",  value: stats.transito,   color: "text-yellow-400" },
          { label: "Delivered",   value: stats.entregadas, color: "text-green-400" },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-dim text-xs mt-1 uppercase tracking-wider">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
        </CardHeader>
        <CoordinacionesClient
          coordinaciones={coordinaciones}
          clienteId={clienteId}
        />
      </Card>
    </div>
  );
}
