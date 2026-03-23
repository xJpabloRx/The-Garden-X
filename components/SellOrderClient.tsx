"use client";
import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Search, Plus, Loader2, X, ShoppingCart, ChevronDown, ChevronRight,
  Trash2, Check, Package, ClipboardList,
} from "lucide-react";

type BoxProduct = { tipo: string; variedad: string; cantidad: number; stem_length: string; color: string };
type ShipInfo = { hawb: string; awb: string; fecha: string };
type Consumed = { invId: string; variedad: string; tipo: string; qty: number };

// A line in the order being built
type OrderLine = {
  key: string; variedad: string; tipo: string; stem_length: string; color: string;
  qty: number;
  // Auto-assigned boxes: invId → qty from that box
  boxAlloc: { invId: string; cajaNum: number; qty: number }[];
  // Manual override?
  manualBoxes: boolean;
};

// Available product across all boxes
type StockProduct = {
  variedad: string; tipo: string; stem_length: string; color: string;
  totalAvail: number;
  boxes: { invId: string; cajaNum: number; avail: number; coordId: string }[];
};

export default function SellOrderClient({
  inventario: rawInv, ventas: rawVentas, creditos: rawCreditos,
  invProductsMap: rawProdsMap, shipLookup, compradores, clienteId,
}: {
  inventario: Record<string, unknown>[];
  ventas: Record<string, unknown>[];
  creditos: Record<string, unknown>[];
  invProductsMap: Record<string, Record<string, unknown>[]>;
  shipLookup: Record<string, ShipInfo>;
  compradores: { id: string; nombre: string }[];
  clienteId: string;
}) {
  const supabase = createClient();

  // Parse consumed (ventas + creditos)
  const consumed = useMemo(() => {
    const list: Consumed[] = [];
    for (const v of rawVentas) {
      list.push({ invId: String(v.inventario_id ?? ""), variedad: String(v.variedad ?? ""), tipo: String(v.tipo_caja ?? ""), qty: Number(v.cantidad ?? 0) });
    }
    for (const c of rawCreditos) {
      list.push({ invId: String(c.inventario_id ?? ""), variedad: String(c.variedad ?? ""), tipo: String(c.tipo_caja ?? ""), qty: Number(c.cantidad ?? 0) });
    }
    return list;
  }, [rawVentas, rawCreditos]);

  // Build stock with per-box availability
  const stock = useMemo(() => {
    const map = new Map<string, StockProduct>();
    for (const raw of rawInv) {
      const invId = String(raw.id);
      const coordId = String(raw.coordinacion_id ?? "");
      const cajaNum = Number(raw.caja_numero ?? 0);
      const prods = (rawProdsMap[invId] || []).map(p => ({
        tipo: String(p.tipo ?? ""), variedad: String(p.variedad ?? ""),
        cantidad: Number(p.cantidad ?? 0), stem_length: String(p.stem_length ?? ""),
        color: String(p.color ?? ""),
      })) as BoxProduct[];

      if (prods.length > 0) {
        for (const p of prods) {
          const soldHere = consumed.filter(c => c.invId === invId && c.variedad === p.variedad && c.tipo === p.tipo).reduce((s, c) => s + c.qty, 0);
          const avail = Math.max(0, p.cantidad - soldHere);
          if (avail <= 0) continue;
          const key = `${p.variedad}|${p.tipo}|${p.stem_length}|${p.color}`;
          if (!map.has(key)) map.set(key, { variedad: p.variedad, tipo: p.tipo, stem_length: p.stem_length, color: p.color, totalAvail: 0, boxes: [] });
          const r = map.get(key)!;
          r.totalAvail += avail;
          r.boxes.push({ invId, cajaNum, avail, coordId });
        }
      }
    }
    // Sort boxes: most available first (to prioritize fuller boxes)
    for (const r of map.values()) r.boxes.sort((a, b) => b.avail - a.avail);
    return Array.from(map.values()).sort((a, b) => a.variedad.localeCompare(b.variedad));
  }, [rawInv, rawProdsMap, consumed]);

  // State
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [buyerId, setBuyerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderPagado, setOrderPagado] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  // Modal multi-select: product key → qty
  const [modalSelections, setModalSelections] = useState<Map<string, number>>(new Map());

  // Completed orders history
  type CompletedOrder = {
    id: string; comprador_nombre: string; fecha_orden: string; pagado: boolean; notas?: string;
    items: { variedad: string; tipo_caja?: string; stem_length?: string; color?: string; cantidad: number; caja_numero?: number; inventario_id?: string }[];
  };
  const [completedOrders, setCompletedOrders] = useState<CompletedOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<"new" | "history">("new");

  useEffect(() => {
    if (!clienteId) return;
    supabase.from("ordenes_venta").select("id, comprador_nombre, fecha_orden, pagado, notas")
      .eq("cliente_id", clienteId).order("fecha_orden", { ascending: false }).limit(50)
      .then(({ data: orders }) => {
        if (!orders || orders.length === 0) return;
        const ids = orders.map(o => o.id);
        supabase.from("orden_venta_items").select("orden_venta_id, variedad, tipo_caja, stem_length, color, cantidad, caja_numero, inventario_id")
          .in("orden_venta_id", ids)
          .then(({ data: items }) => {
            const itemMap = new Map<string, CompletedOrder["items"]>();
            for (const it of (items ?? [])) {
              const oid = it.orden_venta_id;
              if (!itemMap.has(oid)) itemMap.set(oid, []);
              itemMap.get(oid)!.push(it);
            }
            setCompletedOrders(orders.map(o => ({
              id: o.id, comprador_nombre: o.comprador_nombre || "—",
              fecha_orden: o.fecha_orden, pagado: o.pagado, notas: o.notas,
              items: itemMap.get(o.id) || [],
            })));
          });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // Already allocated in current order
  function allocatedForProduct(variedad: string, tipo: string, invId: string): number {
    return orderLines
      .filter(l => l.variedad === variedad && l.tipo === tipo)
      .reduce((s, l) => s + l.boxAlloc.filter(a => a.invId === invId).reduce((ss, a) => ss + a.qty, 0), 0);
  }

  // Remaining availability considering current order allocations
  function remainingAvail(sp: StockProduct): number {
    const allocated = orderLines
      .filter(l => l.variedad === sp.variedad && l.tipo === sp.tipo && l.stem_length === sp.stem_length && l.color === sp.color)
      .reduce((s, l) => s + l.qty, 0);
    return sp.totalAvail - allocated;
  }

  // Auto-allocate qty across boxes (prioritize fullest boxes first)
  function autoAllocate(sp: StockProduct, qty: number): OrderLine["boxAlloc"] {
    const alloc: OrderLine["boxAlloc"] = [];
    let remaining = qty;
    for (const box of sp.boxes) {
      if (remaining <= 0) break;
      const alreadyUsed = allocatedForProduct(sp.variedad, sp.tipo, box.invId);
      const canUse = Math.max(0, box.avail - alreadyUsed);
      if (canUse <= 0) continue;
      const take = Math.min(remaining, canUse);
      alloc.push({ invId: box.invId, cajaNum: box.cajaNum, qty: take });
      remaining -= take;
    }
    return alloc;
  }

  function addSelectedProducts() {
    const newLines: OrderLine[] = [];
    for (const [spKey, qty] of modalSelections) {
      if (qty <= 0) continue;
      const sp = stock.find(s => `${s.variedad}|${s.tipo}|${s.stem_length}|${s.color}` === spKey);
      if (!sp) continue;
      const alloc = autoAllocate(sp, qty);
      newLines.push({
        key: `${Date.now()}-${Math.random()}`, variedad: sp.variedad, tipo: sp.tipo,
        stem_length: sp.stem_length, color: sp.color, qty, boxAlloc: alloc, manualBoxes: false,
      });
    }
    if (newLines.length > 0) setOrderLines(prev => [...prev, ...newLines]);
    setShowSearch(false); setSearchTerm(""); setModalSelections(new Map());
  }

  function setModalQty(spKey: string, qty: number) {
    setModalSelections(prev => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(spKey);
      else next.set(spKey, qty);
      return next;
    });
  }

  function updateLineQty(key: string, newQty: number) {
    setOrderLines(prev => prev.map(l => {
      if (l.key !== key) return l;
      const sp = stock.find(s => s.variedad === l.variedad && s.tipo === l.tipo && s.stem_length === l.stem_length && s.color === l.color);
      if (!sp) return l;
      // Recalculate max available (excluding this line's current allocation)
      const otherAlloc = prev.filter(ol => ol.key !== key && ol.variedad === l.variedad && ol.tipo === l.tipo && ol.stem_length === l.stem_length && ol.color === l.color)
        .reduce((s, ol) => s + ol.qty, 0);
      const maxAvail = sp.totalAvail - otherAlloc;
      const clamped = Math.max(1, Math.min(newQty, maxAvail));
      // Re-allocate boxes
      const tempLines = prev.filter(ol => ol.key !== key);
      const origLines = orderLines;
      // Temporarily set orderLines for allocatedForProduct to work correctly
      // We'll just compute manually
      const alloc: OrderLine["boxAlloc"] = [];
      let rem = clamped;
      for (const box of sp.boxes) {
        if (rem <= 0) break;
        const usedByOthers = tempLines
          .filter(ol => ol.variedad === l.variedad && ol.tipo === l.tipo)
          .reduce((s, ol) => s + ol.boxAlloc.filter(a => a.invId === box.invId).reduce((ss, a) => ss + a.qty, 0), 0);
        const canUse = Math.max(0, box.avail - usedByOthers);
        if (canUse <= 0) continue;
        const take = Math.min(rem, canUse);
        alloc.push({ invId: box.invId, cajaNum: box.cajaNum, qty: take });
        rem -= take;
      }
      return { ...l, qty: clamped, boxAlloc: alloc };
    }));
  }

  function removeLine(key: string) {
    setOrderLines(prev => prev.filter(l => l.key !== key));
  }

  // Search results
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return stock.filter(s => remainingAvail(s) > 0);
    const q = searchTerm.toLowerCase();
    return stock.filter(s => remainingAvail(s) > 0 && (
      s.variedad.toLowerCase().includes(q) || s.tipo.toLowerCase().includes(q) || s.color.toLowerCase().includes(q)
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, stock, orderLines]);

  function getShip(coordId: string): ShipInfo | null {
    return shipLookup[coordId] || null;
  }

  const totalItems = orderLines.reduce((s, l) => s + l.qty, 0);

  async function handleDeleteOrder(orderId: string) {
    if (deletingOrder) return;
    setDeletingOrder(orderId);
    setCompletedOrders(prev => prev.filter(o => o.id !== orderId));
    // Items cascade-delete via FK, just delete the order
    await supabase.from("ordenes_venta").delete().eq("id", orderId);
    setConfirmDeleteOrder(null);
    setDeletingOrder(null);
  }

  function handleReview() {
    if (orderLines.length === 0) return;
    if (!buyerName.trim() && !buyerId) { setError("Select or enter a buyer"); return; }
    setError("");
    setReviewing(true);
  }

  // Edit box allocation for a line during review
  function editLineBoxAlloc(lineKey: string, boxIdx: number, newQty: number) {
    setOrderLines(prev => prev.map(l => {
      if (l.key !== lineKey) return l;
      const sp = stock.find(s => s.variedad === l.variedad && s.tipo === l.tipo && s.stem_length === l.stem_length && s.color === l.color);
      if (!sp) return l;
      const newAlloc = l.boxAlloc.map((a, i) => {
        if (i !== boxIdx) return a;
        const box = sp.boxes.find(b => b.invId === a.invId);
        const maxForBox = box ? box.avail : a.qty;
        return { ...a, qty: Math.max(0, Math.min(newQty, maxForBox)) };
      }).filter(a => a.qty > 0);
      const newTotal = newAlloc.reduce((s, a) => s + a.qty, 0);
      return { ...l, qty: newTotal, boxAlloc: newAlloc };
    }).filter(l => l.qty > 0));
  }

  async function handleSubmit() {
    if (orderLines.length === 0) return;
    if (!buyerName.trim() && !buyerId) { setError("Select or enter a buyer"); return; }
    setSubmitting(true); setError("");

    const finalBuyerName = buyerId
      ? compradores.find(c => c.id === buyerId)?.nombre || buyerName.trim()
      : buyerName.trim();

    // Create order
    const { data: order, error: orderErr } = await supabase.from("ordenes_venta").insert({
      cliente_id: clienteId, comprador_id: buyerId || null,
      comprador_nombre: finalBuyerName, notas: orderNotes.trim() || null, pagado: orderPagado,
    }).select("id").single();

    if (orderErr || !order) { setError(orderErr?.message || "Failed to create order"); setSubmitting(false); return; }

    // Insert order items
    const items = orderLines.flatMap(l =>
      l.boxAlloc.map(a => ({
        orden_venta_id: order.id, inventario_id: a.invId,
        variedad: l.variedad, tipo_caja: l.tipo, stem_length: l.stem_length || null,
        color: l.color || null, cantidad: a.qty, caja_numero: a.cajaNum,
      }))
    );
    if (items.length > 0) {
      const { error: itemErr } = await supabase.from("orden_venta_items").insert(items);
      if (itemErr) { setError(itemErr.message); setSubmitting(false); return; }
    }

    // Also insert into ventas for each allocation (so inventory tracks it)
    const ventasRows = orderLines.flatMap(l =>
      l.boxAlloc.map(a => {
        const base: Record<string, unknown> = {
          cliente_id: clienteId, inventario_id: a.invId,
          variedad: l.variedad, tipo_caja: l.tipo, stem_length: l.stem_length || null,
          color: l.color || null, cantidad: a.qty, comprador: finalBuyerName,
          notas: orderNotes.trim() || null, caja_numero: a.cajaNum,
        };
        return base;
      })
    );
    for (const row of ventasRows) {
      const { error: e1 } = await supabase.from("ventas").insert({ ...row, pagado: orderPagado, fecha_pago: orderPagado ? new Date().toISOString() : null });
      if (e1 && e1.code === "PGRST204") {
        await supabase.from("ventas").insert(row);
      }
    }

    // Update inventory box statuses
    const affectedBoxes = new Set(orderLines.flatMap(l => l.boxAlloc.map(a => a.invId)));
    for (const invId of affectedBoxes) {
      const { data: sales } = await supabase.from("ventas").select("cantidad").eq("inventario_id", invId);
      const totalSold = (sales ?? []).reduce((s, v) => s + v.cantidad, 0);
      const inv = rawInv.find(i => String(i.id) === invId);
      const totalProds = inv ? Number(inv.cantidad_total) : 0;
      const estado = totalSold >= totalProds ? "vendida" : totalSold > 0 ? "parcial" : "disponible";
      await supabase.from("inventario").update({ cantidad_vendida: totalSold, estado_caja: estado }).eq("id", invId);
    }

    // Add to local completed orders
    const finalBuyerDisplay = buyerId ? compradores.find(c => c.id === buyerId)?.nombre || buyerName.trim() : buyerName.trim();
    setCompletedOrders(prev => [{
      id: order.id, comprador_nombre: finalBuyerDisplay,
      fecha_orden: new Date().toISOString(), pagado: orderPagado, notas: orderNotes.trim() || undefined,
      items: orderLines.flatMap(l => l.boxAlloc.map(a => ({
        variedad: l.variedad, tipo_caja: l.tipo, stem_length: l.stem_length, color: l.color,
        cantidad: a.qty, caja_numero: a.cajaNum, inventario_id: a.invId,
      }))),
    }, ...prev]);

    setSubmitted(true); setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Card className="text-center py-6">
          <Check size={40} className="text-green-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Order Completed</h2>
          <p className="text-dim text-sm">{totalItems} items sold to {buyerId ? compradores.find(c => c.id === buyerId)?.nombre : buyerName}</p>
        </Card>
        <Card>
          <CardHeader><CardTitle>Order Summary</CardTitle></CardHeader>
          <div className="space-y-2 px-4 pb-4">
            {orderLines.map(l => (
              <div key={l.key} className="border border-white/5 rounded-lg p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-white font-medium">{l.variedad}</span>
                  <span className="text-xs text-dim capitalize">{l.tipo}</span>
                  {l.color && <span className="text-xs text-purple-400">{l.color}</span>}
                  {l.stem_length && <span className="text-xs text-dim">SL: {l.stem_length}</span>}
                  <span className="ml-auto text-sm text-cyan-400 font-bold">×{l.qty}</span>
                </div>
                {l.boxAlloc.map((a, i) => {
                  const ship = getShip(String(rawInv.find(inv => String(inv.id) === a.invId)?.coordinacion_id ?? ""));
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-dim pl-2">
                      <Package size={10} className="text-cyan-400" />
                      <span className="text-cyan-400 font-mono">Box {a.cajaNum}</span>
                      <span>×{a.qty}</span>
                      {ship && <span>Ship: {ship.fecha.slice(0, 10)}</span>}
                      {ship && <span className="font-mono hidden sm:inline">HAWB: {ship.hawb || "—"}</span>}
                      {ship && <span className="font-mono hidden sm:inline">AWB: {ship.awb || "—"}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
        <button onClick={() => { setOrderLines([]); setBuyerId(""); setBuyerName(""); setOrderNotes(""); setOrderPagado(false); setSubmitted(false); setReviewing(false); setViewTab("new"); }}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold rounded-lg text-sm">
          New Order
        </button>
      </div>
    );
  }

  if (reviewing) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Order Summary — Review & Customize</CardTitle>
            <button onClick={() => setReviewing(false)} className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-400/20 px-3 py-1 rounded-lg">← Back to Edit</button>
          </CardHeader>
          <p className="text-xs text-dim px-4 pb-2">Adjust quantities per box if needed. Products are taken from boxes with the most stock first.</p>
          <div className="space-y-2 px-4 pb-4">
            {orderLines.map(l => {
              const sp = stock.find(s => s.variedad === l.variedad && s.tipo === l.tipo && s.stem_length === l.stem_length && s.color === l.color);
              return (
                <div key={l.key} className="border border-white/5 rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-white font-medium">{l.variedad}</span>
                    <span className="text-xs text-dim capitalize">{l.tipo}</span>
                    {l.color && <span className="text-xs text-purple-400">{l.color}</span>}
                    {l.stem_length && <span className="text-xs text-dim">SL: {l.stem_length}</span>}
                    <span className="ml-auto text-sm text-cyan-400 font-bold">Total: {l.qty}</span>
                  </div>
                  <div className="space-y-1">
                    {l.boxAlloc.map((a, i) => {
                      const ship = getShip(String(rawInv.find(inv => String(inv.id) === a.invId)?.coordinacion_id ?? ""));
                      const boxMax = sp?.boxes.find(b => b.invId === a.invId)?.avail ?? a.qty;
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs py-1.5 px-2 bg-bg/30 rounded border border-white/5">
                          <Package size={12} className="text-cyan-400 flex-shrink-0" />
                          <span className="text-cyan-400 font-mono font-bold">Box {a.cajaNum}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => editLineBoxAlloc(l.key, i, a.qty - 1)}
                              className="w-6 h-6 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded disabled:opacity-30" disabled={a.qty <= 1}>−</button>
                            <span className="text-white font-bold w-8 text-center">{a.qty}</span>
                            <button onClick={() => editLineBoxAlloc(l.key, i, a.qty + 1)}
                              className="w-6 h-6 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded disabled:opacity-30" disabled={a.qty >= boxMax}>+</button>
                          </div>
                          <span className="text-dim">/ {boxMax} avail</span>
                          {ship && <span className="text-dim ml-auto hidden sm:inline">Ship: {ship.fecha.slice(0, 10)}</span>}
                          {ship && <span className="text-dim font-mono hidden sm:inline">HAWB: {ship.hawb || "—"}</span>}
                          {ship && <span className="text-dim font-mono hidden sm:inline">AWB: {ship.awb || "—"}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3">
          <button onClick={() => setReviewing(false)}
            className="flex-1 px-4 py-3 border border-white/10 rounded-lg text-sm text-dim hover:text-white">← Back</button>
          <button onClick={handleSubmit} disabled={submitting || orderLines.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirm & Save ({totalItems} items)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs: New Order / Orders History */}
      <div className="flex gap-2">
        <button onClick={() => setViewTab("new")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${viewTab === "new" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <ShoppingCart size={14} /> New Order
        </button>
        <button onClick={() => setViewTab("history")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${viewTab === "history" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <ClipboardList size={14} /> Orders History ({completedOrders.length})
        </button>
      </div>

      {/* ── ORDERS HISTORY ── */}
      {viewTab === "history" && (
        <Card>
          <CardHeader><CardTitle>Orders History</CardTitle></CardHeader>
          {completedOrders.length === 0 && <p className="text-dim text-sm text-center py-8">No orders yet</p>}
          <div className="space-y-1 px-1 pb-2">
            {completedOrders.map(o => {
              const isOpen = expandedOrder === o.id;
              const totalQty = o.items.reduce((s, it) => s + it.cantidad, 0);
              return (
                <div key={o.id} className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedOrder(isOpen ? null : o.id)}>
                    {isOpen ? <ChevronDown size={12} className="text-cyan-400" /> : <ChevronRight size={12} className="text-dim" />}
                    <span className="text-xs text-cyan-400 font-mono flex-shrink-0">{new Date(o.fecha_orden).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    <span className="text-sm text-white font-medium flex-1 truncate min-w-0">{o.comprador_nombre}</span>
                    <span className="text-xs text-cyan-400 font-bold">×{totalQty}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${o.pagado ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"}`}>
                      {o.pagado ? "Paid" : "Pending"}
                    </span>
                    <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                      {confirmDeleteOrder === o.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-yellow-400">Sure?</span>
                          <button onClick={() => handleDeleteOrder(o.id)} disabled={deletingOrder === o.id}
                            className="text-xs text-red-400 border border-red-400/20 px-2 py-0.5 rounded disabled:opacity-40">
                            {deletingOrder === o.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                          </button>
                          <button onClick={() => setConfirmDeleteOrder(null)}
                            className="text-xs text-dim border border-white/10 px-2 py-0.5 rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteOrder(o.id)}
                          className="text-dim hover:text-red-400 p-1 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="border-t border-white/5 bg-bg/30 px-4 py-3 space-y-2">
                      {o.notas && <p className="text-xs text-dim mb-2">Notes: {o.notas}</p>}
                      {o.items.map((it, i) => {
                        const ship = it.inventario_id ? getShip(String(rawInv.find(inv => String(inv.id) === it.inventario_id)?.coordinacion_id ?? "")) : null;
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                            <Package size={12} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-white font-medium">{it.variedad}</span>
                            <span className="text-dim capitalize">{it.tipo_caja || "—"}</span>
                            {it.color && <span className="text-purple-400">{it.color}</span>}
                            {it.stem_length && <span className="text-dim">SL: {it.stem_length}</span>}
                            <span className="text-cyan-400 font-bold">×{it.cantidad}</span>
                            {it.caja_numero != null && <span className="text-cyan-400 font-mono">Box {it.caja_numero}</span>}
                            {ship && <span className="text-dim hidden sm:inline">Ship: {ship.fecha.slice(0, 10)}</span>}
                            {ship && <span className="text-dim font-mono hidden sm:inline">HAWB: {ship.hawb || "—"}</span>}
                            {ship && <span className="text-dim font-mono hidden sm:inline">AWB: {ship.awb || "—"}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── NEW ORDER ── */}
      {viewTab === "new" && <>
      {/* Buyer selection */}
      <Card>
        <div className="p-4 space-y-3">
          <p className="text-xs text-dim uppercase tracking-wider">Buyer</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {compradores.length > 0 && (
              <select value={buyerId} onChange={e => { setBuyerId(e.target.value); if (e.target.value) setBuyerName(""); }}
                className="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent flex-1">
                <option value="">Select a client...</option>
                {compradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            )}
            <input value={buyerName} onChange={e => { setBuyerName(e.target.value); if (e.target.value) setBuyerId(""); }}
              placeholder={compradores.length > 0 ? "Or type a name..." : "Buyer name..."}
              className="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent flex-1" />
          </div>
        </div>
      </Card>

      {/* Order lines */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items ({orderLines.length})</CardTitle>
          <button onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs hover:bg-cyan-500/20 transition-all">
            <Plus size={12} /> Add Product
          </button>
        </CardHeader>

        {orderLines.length === 0 && (
          <p className="text-dim text-sm text-center py-8">No items yet — click "Add Product" to start</p>
        )}

        {orderLines.length > 0 && (
          <div className="space-y-1 px-1 pb-2">
            {orderLines.map(l => {
              const isOpen = expandedLine === l.key;
              return (
                <div key={l.key} className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => setExpandedLine(isOpen ? null : l.key)}>
                    {isOpen ? <ChevronDown size={12} className="text-cyan-400" /> : <ChevronRight size={12} className="text-dim" />}
                    <span className="text-sm text-white font-medium flex-1 min-w-0 truncate">{l.variedad}</span>
                    <span className="text-xs text-dim capitalize">{l.tipo}</span>
                    {l.color && <span className="text-xs text-purple-400">{l.color}</span>}
                    {l.stem_length && <span className="text-xs text-dim">SL:{l.stem_length}</span>}
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => updateLineQty(l.key, l.qty - 1)} disabled={l.qty <= 1}
                        className="w-6 h-6 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-xs disabled:opacity-30">−</button>
                      <span className="text-sm text-cyan-400 font-bold w-8 text-center">{l.qty}</span>
                      <button onClick={() => updateLineQty(l.key, l.qty + 1)}
                        className="w-6 h-6 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-xs">+</button>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeLine(l.key); }}
                      className="text-dim hover:text-red-400 p-1 transition-colors"><Trash2 size={14} /></button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-white/5 bg-bg/30 px-4 py-3 space-y-1">
                      <p className="text-xs text-dim uppercase tracking-wider mb-1">Box Allocation</p>
                      {l.boxAlloc.map((a, i) => {
                        const ship = getShip(
                          String(rawInv.find(inv => String(inv.id) === a.invId)?.coordinacion_id ?? "")
                        );
                        return (
                          <div key={i} className="flex items-center gap-3 text-xs py-1 border-b border-white/5 last:border-0">
                            <Package size={12} className="text-cyan-400" />
                            <span className="text-cyan-400 font-mono font-bold">Box {a.cajaNum}</span>
                            <span className="text-white">×{a.qty}</span>
                            {ship && <span className="text-dim">Ship: {ship.fecha.slice(0, 10)}</span>}
                            {ship && <span className="text-dim font-mono">HAWB: {ship.hawb || "—"}</span>}
                            {ship && <span className="text-dim font-mono">AWB: {ship.awb || "—"}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Product search modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => { setShowSearch(false); setSearchTerm(""); setModalSelections(new Map()); }}>
          <div className="bg-panel border border-white/10 rounded-2xl p-4 sm:p-6 w-full max-w-lg space-y-4 animate-fade-in max-h-[90vh] sm:max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Products</h3>
              <button onClick={() => { setShowSearch(false); setSearchTerm(""); setModalSelections(new Map()); }} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search variety..."
                autoFocus className="w-full pl-9 pr-3 py-2 bg-bg border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="overflow-y-auto flex-1 space-y-1">
              {searchResults.length === 0 && <p className="text-dim text-sm text-center py-4">No available products</p>}
              {searchResults.map((sp, i) => {
                const spKey = `${sp.variedad}|${sp.tipo}|${sp.stem_length}|${sp.color}`;
                const avail = remainingAvail(sp);
                const selected = modalSelections.get(spKey) || 0;
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    selected > 0 ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/5 hover:border-white/10"
                  }`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white font-medium">{sp.variedad}</span>
                      <div className="flex gap-2 text-xs text-dim mt-0.5">
                        <span className="capitalize">{sp.tipo}</span>
                        {sp.color && <span className="text-purple-400">{sp.color}</span>}
                        {sp.stem_length && <span>SL: {sp.stem_length}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-cyan-400 font-bold flex-shrink-0">{avail} avail</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setModalQty(spKey, selected - 1)} disabled={selected <= 0}
                        className="w-7 h-7 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-sm disabled:opacity-30">−</button>
                      <input type="number" min={0} max={avail} value={selected || ""}
                        onChange={e => setModalQty(spKey, Math.min(avail, Math.max(0, parseInt(e.target.value) || 0)))}
                        placeholder="0"
                        className="w-12 h-7 text-center bg-bg border border-white/10 rounded text-sm text-white focus:outline-none focus:border-accent" />
                      <button onClick={() => setModalQty(spKey, Math.min(avail, selected + 1))} disabled={selected >= avail}
                        className="w-7 h-7 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-sm disabled:opacity-30">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Selected summary + Accept */}
            <div className="border-t border-white/5 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs text-dim">
                {modalSelections.size > 0
                  ? `${modalSelections.size} product${modalSelections.size !== 1 ? "s" : ""}, ${Array.from(modalSelections.values()).reduce((s, q) => s + q, 0)} units`
                  : "Select products and quantities above"}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => { setShowSearch(false); setSearchTerm(""); setModalSelections(new Map()); }}
                  className="px-4 py-2 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
                <button onClick={addSelectedProducts} disabled={modalSelections.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                  <Check size={14} /> Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes + payment + submit */}
      {orderLines.length > 0 && (
        <Card>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-dim mb-1">Notes (optional)</label>
              <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Order notes..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setOrderPagado(!orderPagado)}
                className={`relative w-10 h-5 rounded-full transition-colors ${orderPagado ? "bg-green-500" : "bg-white/10"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${orderPagado ? "translate-x-5" : ""}`} />
              </button>
              <span className={`text-xs ${orderPagado ? "text-green-400" : "text-dim"}`}>{orderPagado ? "Paid" : "Pending payment"}</span>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={handleReview} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
              Review Order ({totalItems} items)
            </button>
          </div>
        </Card>
      )}
      </>}
    </div>
  );
}
