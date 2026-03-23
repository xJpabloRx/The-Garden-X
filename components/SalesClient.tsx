"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Search, RotateCcw, Loader2, Filter,
  DollarSign, ChevronDown, ChevronRight,
  BarChart3, AlertTriangle,
} from "lucide-react";

type VentaRow = {
  id: string; cliente_id: string; inventario_id?: string;
  variedad: string; tipo_caja?: string; stem_length?: string; color?: string;
  cantidad: number; comprador?: string; notas?: string;
  fecha_venta: string; devuelto: boolean; fecha_devolucion?: string;
  pagado?: boolean; fecha_pago?: string; caja_numero?: number; created_at: string;
};
type CreditoRow = {
  id: string; cliente_id: string; inventario_id?: string; venta_id?: string;
  variedad: string; tipo_caja?: string; stem_length?: string; color?: string;
  cantidad: number; caja_numero?: number; motivo: string; notas?: string;
  fecha_credito: string; created_at: string;
};
type ShipDetail = { cajaNum: number; hawb: string; awb: string; fecha: string };

function getWeekRange(d: Date): { start: Date; end: Date } {
  const day = d.getDay();
  const start = new Date(d); start.setDate(d.getDate() - day); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  return { start, end };
}
function getMonthRange(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function fmtMonthLabel(d: Date) { return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
function fmtWeekLabel(d: Date) {
  const { start, end } = getWeekRange(d);
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function SalesClient({
  initialVentas, initialCreditos, clienteId, shipMap,
}: {
  initialVentas: Record<string, unknown>[];
  initialCreditos: Record<string, unknown>[];
  clienteId: string;
  shipMap: Record<string, ShipDetail>;
}) {
  const supabase = createClient();
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [creditos, setCreditos] = useState<CreditoRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"active" | "returned" | "stockSales" | "credits">("active");
  const [search, setSearch] = useState("");
  const [buyerFilter, setBuyerFilter] = useState("");
  const [returning, setReturning] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [movingToCredit, setMovingToCredit] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestoreReturned, setConfirmRestoreReturned] = useState<string | null>(null);
  const [restoringReturned, setRestoringReturned] = useState<string | null>(null);
  const [confirmRestoreActive, setConfirmRestoreActive] = useState<string | null>(null);
  const [restoringActive, setRestoringActive] = useState<string | null>(null);
  const [confirmReturn, setConfirmReturn] = useState<string | null>(null);
  // Period filter for stock sales & credits
  const [periodMode, setPeriodMode] = useState<"month" | "week">("month");
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = current, -1 = previous, etc.

  useEffect(() => {
    function normalizeVentas(rows: Record<string, unknown>[]): VentaRow[] {
      return rows.map(r => ({
        id: String(r.id ?? ""), cliente_id: String(r.cliente_id ?? ""),
        inventario_id: r.inventario_id ? String(r.inventario_id) : undefined,
        variedad: String(r.variedad ?? ""), tipo_caja: r.tipo_caja ? String(r.tipo_caja) : undefined,
        stem_length: r.stem_length ? String(r.stem_length) : undefined,
        color: r.color ? String(r.color) : undefined,
        cantidad: Number(r.cantidad ?? 0), comprador: r.comprador ? String(r.comprador) : undefined,
        notas: r.notas ? String(r.notas) : undefined,
        fecha_venta: String(r.fecha_venta ?? r.created_at ?? ""),
        devuelto: Boolean(r.devuelto), fecha_devolucion: r.fecha_devolucion ? String(r.fecha_devolucion) : undefined,
        pagado: r.pagado != null ? Boolean(r.pagado) : false,
        fecha_pago: r.fecha_pago ? String(r.fecha_pago) : undefined,
        caja_numero: r.caja_numero != null ? Number(r.caja_numero) : undefined,
        created_at: String(r.created_at ?? ""),
      }));
    }
    function normalizeCreditos(rows: Record<string, unknown>[]): CreditoRow[] {
      return rows.map(r => ({
        id: String(r.id ?? ""), cliente_id: String(r.cliente_id ?? ""),
        inventario_id: r.inventario_id ? String(r.inventario_id) : undefined,
        venta_id: r.venta_id ? String(r.venta_id) : undefined,
        variedad: String(r.variedad ?? ""), tipo_caja: r.tipo_caja ? String(r.tipo_caja) : undefined,
        stem_length: r.stem_length ? String(r.stem_length) : undefined,
        color: r.color ? String(r.color) : undefined,
        cantidad: Number(r.cantidad ?? 0), caja_numero: r.caja_numero != null ? Number(r.caja_numero) : undefined,
        motivo: String(r.motivo ?? ""), notas: r.notas ? String(r.notas) : undefined,
        fecha_credito: String(r.fecha_credito ?? r.created_at ?? ""),
        created_at: String(r.created_at ?? ""),
      }));
    }

    if (initialVentas.length > 0) setVentas(normalizeVentas(initialVentas));
    if (initialCreditos.length > 0) setCreditos(normalizeCreditos(initialCreditos));

    // Client-side fallback if server didn't provide data
    if (clienteId && initialVentas.length === 0) {
      supabase.from("ventas").select("*").eq("cliente_id", clienteId)
        .order("fecha_venta", { ascending: false })
        .then(({ data }) => { if (data) setVentas(normalizeVentas(data as Record<string, unknown>[])); });
    }
    if (clienteId && initialCreditos.length === 0) {
      supabase.from("creditos").select("*").eq("cliente_id", clienteId)
        .order("fecha_credito", { ascending: false })
        .then(({ data }) => { if (data) setCreditos(normalizeCreditos(data as Record<string, unknown>[])); });
    }
    setLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = ventas.filter(v => !v.devuelto);
  const returned = ventas.filter(v => v.devuelto);
  const list = tab === "active" ? active : tab === "returned" ? returned : [];
  const buyers = [...new Set(ventas.map(v => v.comprador).filter(Boolean))] as string[];
  const paidCount = active.filter(v => v.pagado).length;
  const pendingCount = active.filter(v => !v.pagado).length;
  const totalSold = active.reduce((s, v) => s + v.cantidad, 0);
  const totalReturned = returned.reduce((s, v) => s + v.cantidad, 0);
  const totalCredits = creditos.reduce((s, c) => s + c.cantidad, 0);

  const filtered = list.filter(v => {
    const matchSearch = !search
      || v.variedad.toLowerCase().includes(search.toLowerCase())
      || (v.comprador || "").toLowerCase().includes(search.toLowerCase())
      || (v.color || "").toLowerCase().includes(search.toLowerCase());
    const matchBuyer = !buyerFilter || v.comprador === buyerFilter;
    return matchSearch && matchBuyer;
  });

  // Period range for stock sales & credits
  const periodRange = useMemo(() => {
    const now = new Date();
    if (periodMode === "month") {
      const d = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      return getMonthRange(d);
    } else {
      const d = new Date(now); d.setDate(d.getDate() + periodOffset * 7);
      return getWeekRange(d);
    }
  }, [periodMode, periodOffset]);

  const periodLabel = useMemo(() => {
    const now = new Date();
    if (periodMode === "month") {
      const d = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      return fmtMonthLabel(d);
    } else {
      const d = new Date(now); d.setDate(d.getDate() + periodOffset * 7);
      return fmtWeekLabel(d);
    }
  }, [periodMode, periodOffset]);

  // Stock Sales: group active sales by variedad within period
  const stockSalesData = useMemo(() => {
    const inRange = active.filter(v => {
      const d = new Date(v.fecha_venta);
      return d >= periodRange.start && d <= periodRange.end;
    });
    const map = new Map<string, { variedad: string; tipo: string; color: string; totalQty: number; totalSales: number }>();
    for (const v of inRange) {
      const key = `${v.variedad}|${v.tipo_caja || ""}|${v.color || ""}`;
      if (!map.has(key)) map.set(key, { variedad: v.variedad, tipo: v.tipo_caja || "—", color: v.color || "—", totalQty: 0, totalSales: 0 });
      const r = map.get(key)!;
      r.totalQty += v.cantidad;
      r.totalSales += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [active, periodRange]);

  // Credits within period
  const filteredCreditos = useMemo(() => {
    return creditos.filter(c => {
      const d = new Date(c.fecha_credito);
      return d >= periodRange.start && d <= periodRange.end;
    });
  }, [creditos, periodRange]);

  function getShipInfo(v: VentaRow): ShipDetail | null {
    if (v.inventario_id && shipMap[v.inventario_id]) return shipMap[v.inventario_id];
    return null;
  }

  async function handleReturn(venta: VentaRow) {
    if (returning) return;
    setReturning(venta.id);
    // Just mark as returned — do NOT touch inventory. Product stays consumed
    // until user explicitly clicks "Restore" which deletes the venta.
    await supabase.from("ventas").update({ devuelto: true, fecha_devolucion: new Date().toISOString() }).eq("id", venta.id);
    setVentas(prev => prev.map(v => v.id === venta.id ? { ...v, devuelto: true, fecha_devolucion: new Date().toISOString() } : v));
    setConfirmReturn(null);
    setReturning(null);
  }

  async function togglePaid(venta: VentaRow) {
    setToggling(venta.id);
    const np = !venta.pagado;
    await supabase.from("ventas").update({ pagado: np, fecha_pago: np ? new Date().toISOString() : null }).eq("id", venta.id);
    setVentas(prev => prev.map(v => v.id === venta.id ? { ...v, pagado: np, fecha_pago: np ? new Date().toISOString() : undefined } : v));
    setToggling(null);
  }

  async function handleMoveToCredit(venta: VentaRow) {
    if (movingToCredit) return; // prevent double-click
    setMovingToCredit(venta.id);
    // Remove from local state immediately to prevent duplicates
    setVentas(prev => prev.filter(v => v.id !== venta.id));
    // Insert into creditos with motivo 'returned'
    const ship = getShipInfo(venta);
    await supabase.from("creditos").insert({
      cliente_id: venta.cliente_id, inventario_id: venta.inventario_id || null,
      venta_id: venta.id, variedad: venta.variedad, tipo_caja: venta.tipo_caja || null,
      stem_length: venta.stem_length || null, color: venta.color || null,
      cantidad: venta.cantidad, caja_numero: venta.caja_numero ?? ship?.cajaNum ?? null,
      motivo: "returned", notas: venta.notas || null,
    });
    // Delete from ventas
    await supabase.from("ventas").delete().eq("id", venta.id);
    // Note: inventory cantidad_vendida was already reduced by handleReturn, no need to touch it again
    // Add to local creditos
    setCreditos(prev => [{
      id: crypto.randomUUID(), cliente_id: venta.cliente_id,
      inventario_id: venta.inventario_id, venta_id: venta.id,
      variedad: venta.variedad, tipo_caja: venta.tipo_caja,
      stem_length: venta.stem_length, color: venta.color,
      cantidad: venta.cantidad, caja_numero: venta.caja_numero ?? ship?.cajaNum,
      motivo: "returned", notas: venta.notas,
      fecha_credito: new Date().toISOString(), created_at: new Date().toISOString(),
    }, ...prev]);
    setMovingToCredit(null);
  }

  async function handleRestoreToInventory(credito: CreditoRow) {
    if (restoring) return; // prevent double-click
    setRestoring(credito.id);
    // Remove from local state immediately to prevent duplicates
    setCreditos(prev => prev.filter(c => c.id !== credito.id));
    // Delete from creditos in DB
    await supabase.from("creditos").delete().eq("id", credito.id);
    // Credits are NOT in ventas, so we don't need to delete from ventas.
    // But credits DO consume from inventory (InventoryClient counts them).
    // Deleting the credit row is enough — InventoryClient will re-query and see fewer consumed.
    // No need to manually adjust cantidad_vendida since it's based on ventas, not creditos.
    setConfirmRestore(null);
    setRestoring(null);
  }

  async function handleRestoreReturned(venta: VentaRow) {
    if (restoringReturned) return; // prevent double-click
    setRestoringReturned(venta.id);
    // Remove from local state immediately to prevent duplicates
    setVentas(prev => prev.filter(v => v.id !== venta.id));
    // Delete the sale entirely and restore inventory
    await supabase.from("ventas").delete().eq("id", venta.id);
    // Returned items already had cantidad_vendida reduced by handleReturn.
    // No further inventory adjustment needed — the venta is gone.
    setConfirmRestoreReturned(null);
    setRestoringReturned(null);
  }

  async function handleRestoreActive(venta: VentaRow) {
    if (restoringActive) return; // prevent double-click
    setRestoringActive(venta.id);
    // Remove from local state immediately to prevent duplicates
    setVentas(prev => prev.filter(v => v.id !== venta.id));
    // Delete the sale entirely and restore inventory
    await supabase.from("ventas").delete().eq("id", venta.id);
    if (venta.inventario_id) {
      const { data: inv } = await supabase.from("inventario").select("cantidad_vendida, cantidad_total").eq("id", venta.inventario_id).single();
      if (inv) {
        const nv = Math.max(0, inv.cantidad_vendida - venta.cantidad);
        await supabase.from("inventario").update({
          cantidad_vendida: nv,
          estado_caja: nv <= 0 ? "disponible" : nv >= inv.cantidad_total ? "vendida" : "parcial",
        }).eq("id", venta.inventario_id);
      }
    }
    setConfirmRestoreActive(null);
    setRestoringActive(null);
  }

  if (!loaded) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cyan-400" size={24} /></div>;

  // Period navigation component
  const PeriodNav = () => (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex gap-1">
        <button onClick={() => setPeriodMode("month")}
          className={`px-2 sm:px-3 py-1 rounded text-xs transition-all ${periodMode === "month" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          Month
        </button>
        <button onClick={() => setPeriodMode("week")}
          className={`px-2 sm:px-3 py-1 rounded text-xs transition-all ${periodMode === "week" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          Week
        </button>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <button onClick={() => setPeriodOffset(p => p - 1)} className="text-dim hover:text-white text-xs px-2 py-1 border border-white/5 rounded">←</button>
        <span className="text-xs text-white font-medium min-w-[100px] sm:min-w-[160px] text-center">{periodLabel}</span>
        <button onClick={() => setPeriodOffset(p => p + 1)} disabled={periodOffset >= 0}
          className="text-dim hover:text-white text-xs px-2 py-1 border border-white/5 rounded disabled:opacity-30">→</button>
      </div>
      {periodOffset !== 0 && <button onClick={() => setPeriodOffset(0)} className="text-xs text-cyan-400 hover:text-cyan-300">Today</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Sales", value: active.length, color: "text-green-400" },
          { label: "Units Sold", value: totalSold, color: "text-cyan-400" },
          { label: "Paid", value: paidCount, color: "text-green-400" },
          { label: "Pending", value: pendingCount, color: "text-yellow-400" },
          { label: "Returned", value: totalReturned, color: "text-red-400" },
          { label: "Credits", value: totalCredits, color: "text-orange-400" },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-dim text-xs mt-1 uppercase tracking-wider">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab("active")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "active" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <DollarSign size={14} /> Active Sales ({active.length})
        </button>
        <button onClick={() => setTab("returned")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "returned" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <RotateCcw size={14} /> Returned ({returned.length})
        </button>
        <button onClick={() => setTab("stockSales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "stockSales" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <BarChart3 size={14} /> Stock Sales
        </button>
        <button onClick={() => setTab("credits")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "credits" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <AlertTriangle size={14} /> Credits ({creditos.length})
        </button>
      </div>

      {/* Search bar for active/returned */}
      {(tab === "active" || tab === "returned") && (
        <Card>
          <div className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search variety, buyer, color..."
                className="w-full pl-9 pr-3 py-1.5 bg-bg border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-accent" />
            </div>
            {buyers.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-dim" />
                <select value={buyerFilter} onChange={e => setBuyerFilter(e.target.value)}
                  className="bg-bg border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent">
                  <option value="">All Buyers</option>
                  {buyers.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── ACTIVE SALES / RETURNED ── */}
      {(tab === "active" || tab === "returned") && (
        <Card>
          <CardHeader>
            <CardTitle>{tab === "active" ? "Active Sales" : "Returned Items"}</CardTitle>
            <span className="text-xs text-dim">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
          </CardHeader>
          {filtered.length === 0 && (
            <p className="text-dim text-sm text-center py-8">{tab === "active" ? "No sales yet" : "No returned items"}</p>
          )}
          {filtered.length > 0 && (
            <div className="space-y-1 px-1 pb-2">
              {filtered.map(v => {
                const isOpen = expanded === v.id;
                const ship = getShipInfo(v);
                const boxNum = v.caja_numero ?? ship?.cajaNum;
                return (
                  <div key={v.id} className={`border border-white/5 rounded-lg overflow-hidden ${v.devuelto ? "opacity-60" : ""}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                      onClick={() => setExpanded(isOpen ? null : v.id)}>
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown size={12} className="text-cyan-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-dim flex-shrink-0" />}
                        <span className="text-xs text-cyan-400 font-mono flex-shrink-0">{fmtDate(v.fecha_venta)}</span>
                        <span className="text-xs text-white font-medium truncate">{v.variedad}</span>
                        <span className="text-xs text-green-400 font-bold flex-shrink-0">×{v.cantidad}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pl-5 sm:pl-0 sm:ml-auto">
                        <span className="text-xs text-dim capitalize">{v.tipo_caja || "—"}</span>
                        <span className="text-xs text-white truncate max-w-[80px]">{v.comprador || "—"}</span>
                        {boxNum != null && <span className="text-xs text-purple-400">Box {boxNum}</span>}
                        <button onClick={(e) => { e.stopPropagation(); togglePaid(v); }} disabled={toggling === v.id || v.devuelto}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all disabled:opacity-40 flex-shrink-0 ${
                            v.pagado ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                          }`}>
                          {toggling === v.id ? <Loader2 size={10} className="animate-spin" /> : v.pagado ? <DollarSign size={10} /> : <span className="w-2 h-2 rounded-full bg-yellow-400/50" />}
                          {v.pagado ? "Paid" : "Pending"}
                        </button>
                        {tab === "active" && (
                          confirmRestoreActive === v.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-yellow-400">Restore?</span>
                              <button onClick={() => handleRestoreActive(v)} disabled={restoringActive === v.id}
                                className="text-xs text-green-400 hover:text-green-300 border border-green-400/20 px-2 py-0.5 rounded transition-all disabled:opacity-40">
                                {restoringActive === v.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                              </button>
                              <button onClick={() => setConfirmRestoreActive(null)}
                                className="text-xs text-dim hover:text-white border border-white/10 px-2 py-0.5 rounded transition-all">No</button>
                            </div>
                          ) : confirmReturn === v.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-yellow-400">Return?</span>
                              <button onClick={() => { handleReturn(v); setConfirmReturn(null); }} disabled={returning === v.id}
                                className="text-xs text-red-400 hover:text-red-300 border border-red-400/20 px-2 py-0.5 rounded transition-all disabled:opacity-40">
                                {returning === v.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                              </button>
                              <button onClick={() => setConfirmReturn(null)}
                                className="text-xs text-dim hover:text-white border border-white/10 px-2 py-0.5 rounded transition-all">No</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); setConfirmRestoreActive(v.id); setConfirmReturn(null); }}
                                className="flex items-center gap-1 text-xs text-cyan-400/60 hover:text-cyan-400 px-1.5 py-0.5 rounded transition-all">
                                <RotateCcw size={10} /> Restore
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setConfirmReturn(v.id); setConfirmRestoreActive(null); }}
                                className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded transition-all">
                                <RotateCcw size={10} /> Return
                              </button>
                            </div>
                          )
                        )}
                        {tab === "returned" && (
                          confirmRestoreReturned === v.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <span className="text-xs text-yellow-400">Sure?</span>
                              <button onClick={() => handleRestoreReturned(v)} disabled={restoringReturned === v.id}
                                className="text-xs text-green-400 hover:text-green-300 border border-green-400/20 px-2 py-0.5 rounded transition-all disabled:opacity-40">
                                {restoringReturned === v.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                              </button>
                              <button onClick={() => setConfirmRestoreReturned(null)}
                                className="text-xs text-dim hover:text-white border border-white/10 px-2 py-0.5 rounded transition-all">No</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={(e) => { e.stopPropagation(); setConfirmRestoreReturned(v.id); }}
                                className="flex items-center gap-1 text-xs text-cyan-400/60 hover:text-cyan-400 px-1.5 py-0.5 rounded transition-all">
                                <RotateCcw size={10} /> Restore
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleMoveToCredit(v); }} disabled={movingToCredit === v.id}
                                className="flex items-center gap-1 text-xs text-orange-400/60 hover:text-orange-400 px-1.5 py-0.5 rounded transition-all disabled:opacity-40">
                                {movingToCredit === v.id ? <Loader2 size={10} className="animate-spin" /> : <><AlertTriangle size={10} /> Credit</>}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-white/5 bg-bg/30 px-3 sm:px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                        <div><span className="text-dim">Variety:</span> <span className="text-white ml-1">{v.variedad}</span></div>
                        <div><span className="text-dim">Type:</span> <span className="text-white ml-1 capitalize">{v.tipo_caja || "—"}</span></div>
                        <div><span className="text-dim">Color:</span> <span className="text-purple-400 ml-1">{v.color || "—"}</span></div>
                        <div><span className="text-dim">Stem Length:</span> <span className="text-white ml-1">{v.stem_length || "—"}</span></div>
                        <div><span className="text-dim">Quantity:</span> <span className="text-green-400 ml-1 font-bold">{v.cantidad}</span></div>
                        <div><span className="text-dim">Buyer:</span> <span className="text-white ml-1">{v.comprador || "—"}</span></div>
                        {boxNum != null && <div><span className="text-dim">Box:</span> <span className="text-cyan-400 ml-1 font-mono font-bold">Box {boxNum}</span></div>}
                        {ship && <div><span className="text-dim">HAWB:</span> <span className="text-cyan-400 ml-1 font-mono">{ship.hawb}</span></div>}
                        {ship && <div><span className="text-dim">AWB:</span> <span className="text-dim ml-1 font-mono">{ship.awb}</span></div>}
                        {ship && <div><span className="text-dim">Ship Date:</span> <span className="text-dim ml-1">{ship.fecha.slice(0, 10)}</span></div>}
                        <div><span className="text-dim">Sale Date:</span> <span className="text-cyan-400 ml-1">{new Date(v.fecha_venta).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
                        <div><span className="text-dim">Payment:</span> <span className={`ml-1 ${v.pagado ? "text-green-400" : "text-yellow-400"}`}>{v.pagado ? "Paid" : "Pending"}</span></div>
                        {v.notas && <div className="col-span-2"><span className="text-dim">Notes:</span> <span className="text-white ml-1">{v.notas}</span></div>}
                        {v.devuelto && v.fecha_devolucion && <div className="col-span-2"><span className="text-dim">Returned:</span> <span className="text-red-400 ml-1">{fmtDate(v.fecha_devolucion)}</span></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── STOCK SALES ── */}
      {tab === "stockSales" && (
        <Card>
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
            <CardTitle>Stock Sales</CardTitle>
            <PeriodNav />
          </CardHeader>
          {stockSalesData.length === 0 && <p className="text-dim text-sm text-center py-8">No sales in this period</p>}
          {stockSalesData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-dim text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Variety</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Color</th>
                    <th className="text-right py-2 px-3">Sales</th>
                    <th className="text-right py-2 px-3">Units Sold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {stockSalesData.map((r, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="py-2.5 px-3 text-white font-medium">{r.variedad}</td>
                      <td className="py-2.5 px-3 text-xs text-dim capitalize">{r.tipo}</td>
                      <td className="py-2.5 px-3 text-xs text-purple-400">{r.color}</td>
                      <td className="py-2.5 px-3 text-xs text-dim text-right">{r.totalSales}</td>
                      <td className="py-2.5 px-3 text-xs text-cyan-400 text-right font-bold">{r.totalQty}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={3} className="py-2.5 px-3 text-xs text-dim font-bold uppercase">Total</td>
                    <td className="py-2.5 px-3 text-xs text-dim text-right font-bold">{stockSalesData.reduce((s, r) => s + r.totalSales, 0)}</td>
                    <td className="py-2.5 px-3 text-xs text-cyan-400 text-right font-bold">{stockSalesData.reduce((s, r) => s + r.totalQty, 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── CREDITS ── */}
      {tab === "credits" && (
        <Card>
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
            <CardTitle>Credits</CardTitle>
            <PeriodNav />
          </CardHeader>
          {filteredCreditos.length === 0 && <p className="text-dim text-sm text-center py-8">No credits in this period</p>}
          {filteredCreditos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-dim text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Variety</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Color</th>
                    <th className="text-left py-2 px-3">SL</th>
                    <th className="text-right py-2 px-3">Qty</th>
                    <th className="text-left py-2 px-3">Box</th>
                    <th className="text-left py-2 px-3">Reason</th>
                    <th className="text-left py-2 px-3">Notes</th>
                    <th className="text-right py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCreditos.map(c => (
                    <tr key={c.id} className="hover:bg-white/2">
                      <td className="py-2.5 px-3 text-xs text-cyan-400 font-mono">{fmtDate(c.fecha_credito)}</td>
                      <td className="py-2.5 px-3 text-white font-medium text-xs">{c.variedad}</td>
                      <td className="py-2.5 px-3 text-xs text-dim capitalize">{c.tipo_caja || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-purple-400">{c.color || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-dim">{c.stem_length || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-orange-400 text-right font-bold">{c.cantidad}</td>
                      <td className="py-2.5 px-3 text-xs text-cyan-400 font-mono">{c.caja_numero != null ? `Box ${c.caja_numero}` : "—"}</td>
                      <td className="py-2.5 px-3 text-xs capitalize">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          c.motivo === "returned" ? "bg-red-400/10 text-red-400 border border-red-400/20"
                          : c.motivo === "damaged" ? "bg-orange-400/10 text-orange-400 border border-orange-400/20"
                          : "bg-white/5 text-dim border border-white/10"
                        }`}>{c.motivo}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-dim">{c.notas || "—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        {confirmRestore === c.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-xs text-yellow-400 mr-1">Are you sure?</span>
                            <button onClick={() => handleRestoreToInventory(c)} disabled={restoring === c.id}
                              className="text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-2 py-0.5 rounded transition-all disabled:opacity-40">
                              {restoring === c.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                            </button>
                            <button onClick={() => setConfirmRestore(null)}
                              className="text-xs text-dim hover:text-white border border-white/10 px-2 py-0.5 rounded transition-all">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmRestore(c.id)}
                            className="flex items-center gap-1 text-xs text-cyan-400/60 hover:text-cyan-400 border border-cyan-400/10 hover:border-cyan-400/30 px-2 py-0.5 rounded transition-all ml-auto">
                            <RotateCcw size={10} /> Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td colSpan={5} className="py-2.5 px-3 text-xs text-dim font-bold uppercase">Total</td>
                    <td className="py-2.5 px-3 text-xs text-orange-400 text-right font-bold">{filteredCreditos.reduce((s, c) => s + c.cantidad, 0)}</td>
                    <td colSpan={3}></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
