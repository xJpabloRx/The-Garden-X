import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import CoordinacionesClient from "@/components/CoordinacionesClient";
import type { Coordinacion } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user!.id).single();

  const clienteId = cliente?.id ?? "";

  // Try coordinaciones first
  const { data: coords } = await supabase
    .from("coordinaciones")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  let coordinaciones: Coordinacion[] = (coords as Coordinacion[]) ?? [];

  // If no coordinaciones, build from exportaciones (fallback)
  if (coordinaciones.length === 0 && clienteId) {
    const { data: exps } = await supabase
      .from("exportaciones")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (exps && exps.length > 0) {
      // Group by fecha+hawb+awb to create virtual coordinaciones
      const grouped = new Map<string, Coordinacion>();
      for (const e of exps) {
        const key = `${e.fecha}|${e.hawb}|${e.awb}`;
        if (!grouped.has(key)) {
          // Parse cajas
          let cajas = e.cajas;
          if (typeof cajas === "string") try { cajas = JSON.parse(cajas); } catch { cajas = []; }
          let productos = e.productos;
          if (typeof productos === "string") try { productos = JSON.parse(productos); } catch { productos = []; }

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
            estado: "coordinado",
            qr_token: e.qr_token,
            export_id: e.export_id,
            productos: Array.isArray(productos) ? productos : [],
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
  }

  const stats = {
    total:      coordinaciones.length,
    transito:   coordinaciones.filter(c => c.estado === "en_transito").length,
    entregadas: coordinaciones.filter(c => c.estado === "entregado").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Shipments</h1>
        <p className="text-dim text-sm mt-1">Export history and shipment status</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",       value: stats.total,      color: "text-cyan-400" },
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
