"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Coordinacion, CajaItem } from "@/lib/types";
import { PackagePlus, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type BoxDetail = { tipo: string; variedad: string; cantidad: number; stem_length?: string; color?: string };

function parseCajas(raw: unknown): CajaItem[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}

export default function CoordinacionesClient({
  coordinaciones: initial,
  clienteId,
}: {
  coordinaciones: Coordinacion[];
  clienteId: string;
}) {
  const [coordinaciones, setCoordinaciones] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // Sync inventario_creado from DB on mount — catches cases where
  // another device already moved a shipment to inventory
  useEffect(() => {
    if (!clienteId || initial.length === 0) return;
    // Check exportaciones directly for the inventario_creado flag
    const ids = initial.filter(c => !c.inventario_creado).map(c => c.id);
    if (ids.length === 0) return;
    supabase
      .from("exportaciones")
      .select("id, inventario_creado")
      .in("id", ids)
      .eq("inventario_creado", true)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const movedIds = new Set(data.map(r => r.id));
        setCoordinaciones(prev =>
          prev.map(c => movedIds.has(c.id) ? { ...c, inventario_creado: true } : c)
        );
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveToInventory(coord: Coordinacion) {
    if (coord.inventario_creado || loading) return;
    setLoading(coord.id);
    setCoordinaciones(prev =>
      prev.map(c => c.id === coord.id ? { ...c, inventario_creado: true } : c)
    );
    setError("");
    try {
      // DB-level guard: check if inventory already exists
      const { data: existById } = await supabase
        .from("inventario").select("id").eq("coordinacion_id", coord.id).limit(1);
      if (existById && existById.length > 0) { setLoading(null); return; }
      if (coord.qr_token) {
        const { data: existByQr } = await supabase
          .from("inventario").select("id").eq("qr_token", coord.qr_token).eq("cliente_id", clienteId).limit(1);
        if (existByQr && existByQr.length > 0) { setLoading(null); return; }
      }

      const cajas = parseCajas(coord.cajas);

      // Check if coord.id exists in coordinaciones table
      const { data: realCoord } = await supabase
        .from("coordinaciones").select("id").eq("id", coord.id).single();
      const coordId = realCoord ? coord.id : null;

      for (const caja of cajas) {
        const prods = Array.isArray(caja.productos)
          ? (caja.productos as { tipo?: string; variedad?: string; cantidad?: number; stem_length?: string; color?: string }[])
          : [];
        const esBonche = String(caja.titulo ?? "").toLowerCase().includes("bonche");

        // Calculate total: sum of product quantities (units, not stems)
        const prodTotal = prods.reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
        const cantidadTotal = prodTotal > 0
          ? prodTotal
          : (parseInt(String(caja.cantidad)) || parseInt(String(caja.bunch)) || 25);

        // Determine variedad: use box title (BCOLOR, BROJO, etc.) not product list
        const mainVariedad = String(caja.titulo || "").replace(/^B/i, "") || coord.variedad || null;

        const { data: inv, error: invErr } = await supabase.from("inventario").insert({
          cliente_id: clienteId,
          coordinacion_id: coordId,
          caja_numero: caja.caja,
          tipo_caja: esBonche ? "bonche" : "bouquet",
          categoria: String(caja.titulo ?? "").toLowerCase().includes("rojo") ? "rojo" : "color",
          variedad: mainVariedad,
          cantidad_total: cantidadTotal,
          cantidad_vendida: 0,
          estado_caja: "disponible",
          qr_token: coord.qr_token ?? null,
          notas: caja.composicion ?? null,
          productos: prods.length > 0 ? prods : [],
        }).select("id").single();

        if (invErr) { setError(`Box ${caja.caja}: ${invErr.message}`); continue; }
        if (!inv) continue;

        // Create inventory_items from detailed products
        const items: { inventario_id: string; descripcion: string; cantidad: number; vendido: boolean }[] = [];
        if (prods.length > 0) {
          for (const p of prods) {
            const qty = Number(p.cantidad) || 1;
            const tipo = p.tipo || (esBonche ? "bonche" : "bouquet");
            for (let j = 0; j < qty; j++) {
              items.push({
                inventario_id: inv.id,
                descripcion: `${tipo} ${p.variedad || ""} SL:${p.stem_length || ""} ${p.color || ""}`.trim(),
                cantidad: 1,
                vendido: false,
              });
            }
          }
        } else {
          // No detailed products — create generic items
          const count = cantidadTotal;
          for (let j = 0; j < count; j++) {
            items.push({
              inventario_id: inv.id,
              descripcion: `${esBonche ? "bonche" : "bouquet"} ${mainVariedad ?? ""}`.trim(),
              cantidad: 1,
              vendido: false,
            });
          }
        }
        if (items.length > 0) {
          await supabase.from("inventario_items").insert(items);
        }
      }

      // If no cajas at all, create a single fallback entry
      if (cajas.length === 0) {
        await supabase.from("inventario").insert({
          cliente_id: clienteId,
          coordinacion_id: coordId,
          caja_numero: 1,
          tipo_caja: "bouquet",
          categoria: "color",
          variedad: coord.variedad ?? null,
          cantidad_total: (coord.hbs ?? 1) * 12,
          cantidad_vendida: 0,
          estado_caja: "disponible",
          qr_token: coord.qr_token ?? null,
          notas: null,
        });
      }

      // Mark as moved
      await supabase.from("coordinaciones").update({ inventario_creado: true }).eq("id", coord.id);
      // Also mark on exportaciones (the source of truth for most clients)
      await supabase
        .from("exportaciones").update({ inventario_creado: true }).eq("id", coord.id);
      if (coord.export_id) {
        await supabase
          .from("exportaciones").update({ inventario_creado: true }).eq("export_id", coord.export_id);
      }

      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : JSON.stringify(e);
      console.error("Move to inventory error:", msg);
      if (!error) setError(msg);
      // Revert on error so user can retry
      setCoordinaciones(prev =>
        prev.map(c => c.id === coord.id ? { ...c, inventario_creado: false } : c)
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}
      <div className="space-y-2">
        {coordinaciones.length === 0 && (
          <p className="text-dim text-sm text-center py-8">No shipments yet</p>
        )}
        {coordinaciones.map(c => {
          const cajas = parseCajas(c.cajas).sort((a, b) => Number(a.caja) - Number(b.caja));
          const isOpen = expanded === c.id;

          return (
            <div key={c.id} className="border border-white/5 rounded-lg overflow-hidden">
              {/* Header row */}
              <div
                className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => setExpanded(isOpen ? null : c.id)}
              >
                {isOpen
                  ? <ChevronDown size={14} className="text-cyan-400 flex-shrink-0" />
                  : <ChevronRight size={14} className="text-dim flex-shrink-0" />}
                <span className="text-xs font-mono text-cyan-400">{c.hawb || "—"}</span>
                <span className="text-xs text-dim hidden sm:inline">{c.awb || "—"}</span>
                <span className="text-xs flex-1 truncate">{c.origen} → {c.destino}</span>
                <span className="text-xs text-dim hidden sm:inline">{formatDate(c.fecha_salida)}</span>
                {c.fecha_confirmada_miami && (
                  <span className="text-xs text-green-400 hidden sm:inline">Arrived: {formatDate(c.fecha_confirmada_miami)}</span>
                )}
                {!c.fecha_confirmada_miami && c.fecha_estimada_miami && (
                  <span className="text-xs text-amber-400 hidden sm:inline">ETA: {formatDate(c.fecha_estimada_miami)}</span>
                )}
                <span className="text-xs text-purple-400">{cajas.length} box{cajas.length !== 1 ? "es" : ""}</span>
                <Badge estado={c.estado} />
                <div onClick={e => e.stopPropagation()}>
                  {c.inventario_creado ? (
                    <span className="text-xs text-green-400 font-mono">✓</span>
                  ) : (
                    <button
                      onClick={() => moveToInventory(c)}
                      disabled={loading === c.id || c.inventario_creado}
                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-400/20 hover:border-purple-400/40 px-2 py-1 rounded transition-all disabled:opacity-40"
                    >
                      {loading === c.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <PackagePlus size={12} />}
                      Move
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: box details */}
              {isOpen && (
                <div className="border-t border-white/5 bg-bg/30 px-3 sm:px-4 py-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <div className="bg-panel rounded-lg px-3 py-2">
                      <p className="text-[10px] text-dim uppercase">Departure</p>
                      <p className="text-xs text-white font-mono">{formatDate(c.fecha_salida) || "—"}</p>
                    </div>
                    <div className="bg-panel rounded-lg px-3 py-2">
                      <p className="text-[10px] text-dim uppercase">Est. Arrival</p>
                      <p className="text-xs text-amber-400 font-mono">{c.fecha_estimada_miami ? formatDate(c.fecha_estimada_miami) : "—"}</p>
                    </div>
                    <div className="bg-panel rounded-lg px-3 py-2">
                      <p className="text-[10px] text-dim uppercase">Confirmed Arrival</p>
                      <p className="text-xs text-green-400 font-mono">{c.fecha_confirmada_miami ? formatDate(c.fecha_confirmada_miami) : "—"}</p>
                    </div>
                    <div className="bg-panel rounded-lg px-3 py-2">
                      <p className="text-[10px] text-dim uppercase">DAE</p>
                      <p className="text-xs text-white font-mono">{c.dae || "—"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-dim mb-2">
                    <span>HBs: {c.hbs ?? "—"}</span>
                  </div>

                  {cajas.length === 0 && <p className="text-xs text-dim italic">No box details available</p>}

                  {cajas.map((box, i) => {
                    const prods = Array.isArray(box.productos) ? (box.productos as BoxDetail[]) : [];
                    return (
                      <div key={i} className="border border-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-cyan-400 font-bold">Box {box.caja}</span>
                          <span className="text-xs text-white flex-1">{box.titulo || "—"}</span>
                          {box.stem_length && <span className="text-xs text-dim">SL: {box.stem_length}</span>}
                          {box.bunch && <span className="text-xs text-dim">Bunch: {box.bunch}</span>}
                        </div>
                        {box.composicion && (
                          <p className="text-xs text-dim mt-1 ml-4">{box.composicion}</p>
                        )}
                        {prods.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1">
                            {prods.map((p, pi) => (
                              <div key={pi} className="flex items-center gap-2 text-xs text-dim">
                                <span className="text-white capitalize">{p.tipo}</span>
                                <span className="text-cyan-400">{p.variedad}</span>
                                <span>×{p.cantidad}</span>
                                {p.stem_length && <span>SL: {p.stem_length}</span>}
                                {p.color && <span className="text-purple-400">{p.color}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
