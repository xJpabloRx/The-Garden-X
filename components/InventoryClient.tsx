"use client";
import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Inventario } from "@/lib/types";
import {
  ChevronDown, ChevronRight, Search,
  ShoppingCart, Loader2, Package, X, AlertTriangle,
} from "lucide-react";

type ShipInfo = { hawb: string; awb: string; fecha: string; variedad: string; origen: string; destino: string };
type BoxProduct = { tipo: string; variedad: string; cantidad: number; stem_length: string; color: string };
type ShipGroup = { key: string; info: ShipInfo; boxes: Inventario[] };

// Per-product sold tracking from ventas
type ProductSold = { invId: string; variedad: string; tipo: string; stem_length: string; color: string; sold: number };

type StockRow = {
  variedad: string; tipo: string; stem_length: string; color: string;
  total: number; sold: number; available: number;
  // Which boxes contain this product: invId → quantity in that box
  boxes: { invId: string; cajaNum: number; qty: number; soldFromBox: number }[];
};

type SellMode = 
  | { from: "product"; invId: string; cajaNum: number; variedad: string; tipo: string; stem_length: string; color: string; maxQty: number }
  | { from: "box"; invId: string; cajaNum: number; products: BoxProduct[] }
  | { from: "stock"; row: StockRow };

function groupByShipment(inventario: Inventario[], shipLookup: Record<string, ShipInfo>): ShipGroup[] {
  const groups = new Map<string, ShipGroup>();
  for (const inv of inventario) {
    const info = (inv.coordinacion_id && shipLookup[inv.coordinacion_id])
      ? shipLookup[inv.coordinacion_id]
      : { hawb: "—", awb: "—", fecha: inv.created_at?.slice(0, 10) || "—", variedad: inv.variedad || "", origen: "", destino: "" };
    const key = `${info.hawb}|${info.awb}|${info.fecha}`;
    if (!groups.has(key)) groups.set(key, { key, info, boxes: [] });
    groups.get(key)!.boxes.push(inv);
  }
  for (const g of groups.values()) g.boxes.sort((a, b) => (a.caja_numero ?? 0) - (b.caja_numero ?? 0));
  return Array.from(groups.values()).sort((a, b) => b.info.fecha.localeCompare(a.info.fecha));
}

export default function InventoryClient({
  inventario: initial, clienteId, shipLookup, invProductsMap,
}: {
  inventario: Inventario[]; clienteId: string;
  shipLookup: Record<string, ShipInfo>;
  invProductsMap: Record<string, BoxProduct[]>;
}) {
  const supabase = createClient();
  const [inventario, setInventario] = useState(initial);
  const [expandedShip, setExpandedShip] = useState<string | null>(null);
  const [expandedBox, setExpandedBox] = useState<string | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [tab, setTab] = useState<"stock" | "shipments">("stock");

  // Sell modal state
  const [sellMode, setSellMode] = useState<SellMode | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [sellBuyer, setSellBuyer] = useState("");
  const [sellNotes, setSellNotes] = useState("");
  const [sellPagado, setSellPagado] = useState(false);
  const [selling, setSelling] = useState(false);
  const [sellError, setSellError] = useState("");
  // For stock summary sell: which box to deduct from
  const [selectedBoxId, setSelectedBoxId] = useState<string>("");

  // Credit modal state
  const [creditMode, setCreditMode] = useState<{ invId: string; cajaNum: number; variedad: string; tipo: string; stem_length: string; color: string; maxQty: number } | null>(null);
  const [creditQty, setCreditQty] = useState(1);
  const [creditMotivo, setCreditMotivo] = useState("damaged");
  const [creditNotas, setCreditNotas] = useState("");
  const [crediting, setCrediting] = useState(false);
  const [creditError, setCreditError] = useState("");

  // Load ventas to track per-product sales
  const [productSales, setProductSales] = useState<ProductSold[]>([]);
  useEffect(() => {
    if (!clienteId) return;
    // Load ventas
    const loadVentas = supabase.from("ventas").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
      .eq("cliente_id", clienteId);
    // Load creditos (also consume from inventory)
    const loadCreditos = supabase.from("creditos").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
      .eq("cliente_id", clienteId);
    Promise.all([loadVentas, loadCreditos]).then(([ventasRes, creditosRes]) => {
      const sales: ProductSold[] = [];
      for (const v of (ventasRes.data ?? [])) {
        sales.push({ invId: v.inventario_id || "", variedad: v.variedad, tipo: v.tipo_caja || "", stem_length: v.stem_length || "", color: v.color || "", sold: v.cantidad });
      }
      for (const c of (creditosRes.data ?? [])) {
        sales.push({ invId: c.inventario_id || "", variedad: c.variedad, tipo: c.tipo_caja || "", stem_length: c.stem_length || "", color: c.color || "", sold: c.cantidad });
      }
      setProductSales(sales);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  // Helper: how many of a specific product have been sold from a specific box
  function soldFromBox(invId: string, variedad: string, tipo: string): number {
    return productSales
      .filter(s => s.invId === invId && s.variedad === variedad && s.tipo === tipo)
      .reduce((sum, s) => sum + s.sold, 0);
  }

  // Helper: total sold of a product across all boxes
  function totalSoldProduct(variedad: string, tipo: string, stem_length: string, color: string): number {
    return productSales
      .filter(s => s.variedad === variedad && s.tipo === tipo && s.stem_length === stem_length && s.color === color)
      .reduce((sum, s) => sum + s.sold, 0);
  }

  const groups = groupByShipment(inventario, shipLookup);

  // Build stock from products across all boxes, using ventas for sold tracking
  const stock = useMemo(() => {
    const map = new Map<string, StockRow>();
    for (const inv of inventario) {
      const prods = invProductsMap[inv.id] || [];
      if (prods.length > 0) {
        for (const p of prods) {
          const key = `${p.variedad}|${p.tipo}|${p.stem_length}|${p.color}`;
          if (!map.has(key)) {
            map.set(key, { variedad: p.variedad, tipo: p.tipo, stem_length: p.stem_length, color: p.color, total: 0, sold: 0, available: 0, boxes: [] });
          }
          const r = map.get(key)!;
          const soldHere = soldFromBox(inv.id, p.variedad, p.tipo);
          const availHere = Math.max(0, p.cantidad - soldHere);
          r.total += p.cantidad;
          r.sold += soldHere;
          r.available += availHere;
          r.boxes.push({ invId: inv.id, cajaNum: inv.caja_numero ?? 0, qty: p.cantidad, soldFromBox: soldHere });
        }
      } else {
        const key = `${inv.variedad || "Unknown"}|${inv.tipo_caja || "bouquet"}||`;
        if (!map.has(key)) {
          map.set(key, { variedad: inv.variedad || "Unknown", tipo: inv.tipo_caja || "bouquet", stem_length: "", color: "", total: 0, sold: 0, available: 0, boxes: [] });
        }
        const r = map.get(key)!;
        r.total += inv.cantidad_total;
        r.sold += inv.cantidad_vendida;
        r.available += (inv.cantidad_total - inv.cantidad_vendida);
        r.boxes.push({ invId: inv.id, cajaNum: inv.caja_numero ?? 0, qty: inv.cantidad_total, soldFromBox: inv.cantidad_vendida });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      // Bonche first, then bouquet
      const typeOrder = (t: string) => t.toLowerCase().includes("bonche") ? 0 : 1;
      const ta = typeOrder(a.tipo), tb = typeOrder(b.tipo);
      if (ta !== tb) return ta - tb;
      // Then by available descending
      if (b.available !== a.available) return b.available - a.available;
      return a.variedad.localeCompare(b.variedad);
    });
  }, [inventario, invProductsMap, productSales]);

  const filteredStock = (stockSearch
    ? stock.filter(r => r.variedad.toLowerCase().includes(stockSearch.toLowerCase()) || r.color.toLowerCase().includes(stockSearch.toLowerCase()))
    : stock
  ).filter(r => r.available > 0);
  const totalAvail = stock.reduce((s, r) => s + r.available, 0);
  const totalSold = stock.reduce((s, r) => s + r.sold, 0);

  function resetModal() {
    setSellMode(null); setSellQty(1); setSellBuyer(""); setSellNotes(""); setSellPagado(false); setSellError(""); setSelectedBoxId("");
  }

  function resetCreditModal() {
    setCreditMode(null); setCreditQty(1); setCreditMotivo("damaged"); setCreditNotas(""); setCreditError("");
  }

  async function handleCredit() {
    if (!creditMode || creditQty < 1) return;
    setCrediting(true); setCreditError("");
    const { error } = await supabase.from("creditos").insert({
      cliente_id: clienteId, inventario_id: creditMode.invId || null,
      variedad: creditMode.variedad, tipo_caja: creditMode.tipo,
      stem_length: creditMode.stem_length || null, color: creditMode.color || null,
      cantidad: creditQty, caja_numero: creditMode.cajaNum || null,
      motivo: creditMotivo, notas: creditNotas || null,
    });
    if (error) { setCreditError(error.message); setCrediting(false); return; }
    // Update box status (reduce available)
    await updateBoxStatus(creditMode.invId);
    // Add to productSales so UI reflects the deduction
    setProductSales(prev => [...prev, {
      invId: creditMode.invId, variedad: creditMode.variedad, tipo: creditMode.tipo,
      stem_length: creditMode.stem_length, color: creditMode.color, sold: creditQty,
    }]);
    resetCreditModal(); setCrediting(false);
  }

  // Get available qty for a product in a specific box
  function availableInBox(invId: string, p: BoxProduct): number {
    return Math.max(0, p.cantidad - soldFromBox(invId, p.variedad, p.tipo));
  }

  async function handleSell() {
    if (!sellMode || sellQty < 1) return;
    setSelling(true); setSellError("");

    let variedad = "", tipo = "", stem_length = "", color = "", invId = "", cajaNum = 0;

    if (sellMode.from === "product") {
      variedad = sellMode.variedad; tipo = sellMode.tipo;
      stem_length = sellMode.stem_length; color = sellMode.color;
      invId = sellMode.invId; cajaNum = sellMode.cajaNum;
    } else if (sellMode.from === "box") {
      // Sell entire box — record one sale per product
      invId = sellMode.invId; cajaNum = sellMode.cajaNum;
      const results = [];
      for (const p of sellMode.products) {
        const avail = availableInBox(invId, p);
        if (avail <= 0) continue;
        results.push(insertSale(invId, cajaNum, p.variedad, p.tipo, p.stem_length, p.color, avail));
      }
      const errors = (await Promise.all(results)).filter(Boolean);
      if (errors.length > 0) { setSellError(errors.join("; ")); setSelling(false); return; }
      await updateBoxStatus(invId);
      await refreshSales();
      resetModal(); setSelling(false);
      return;
    } else if (sellMode.from === "stock") {
      variedad = sellMode.row.variedad; tipo = sellMode.row.tipo;
      stem_length = sellMode.row.stem_length; color = sellMode.row.color;
      invId = selectedBoxId;
      const box = sellMode.row.boxes.find(b => b.invId === selectedBoxId);
      cajaNum = box?.cajaNum ?? 0;
      if (!invId) { setSellError("Select a box to deduct from"); setSelling(false); return; }
    }

    const err = await insertSale(invId, cajaNum, variedad, tipo, stem_length, color, sellQty);
    if (err) { setSellError(err); setSelling(false); return; }
    await updateBoxStatus(invId);
    await refreshSales();
    resetModal(); setSelling(false);
  }

  async function insertSale(invId: string, cajaNum: number, variedad: string, tipo: string, stem_length: string, color: string, qty: number): Promise<string | null> {
    const base: Record<string, unknown> = {
      cliente_id: clienteId, inventario_id: invId || null,
      variedad, tipo_caja: tipo, stem_length: stem_length || null, color: color || null,
      cantidad: qty, comprador: sellBuyer || null, notas: sellNotes || null,
      caja_numero: cajaNum || null,
    };
    // Try with pagado
    const { error: e1 } = await supabase.from("ventas").insert({ ...base, pagado: sellPagado, fecha_pago: sellPagado ? new Date().toISOString() : null });
    if (e1 && e1.code === "PGRST204") {
      const { error: e2 } = await supabase.from("ventas").insert(base);
      if (e2) return e2.message;
    } else if (e1) return e1.message;
    return null;
  }

  async function updateBoxStatus(invId: string) {
    const inv = inventario.find(i => i.id === invId);
    if (!inv) return;
    // Recalculate: sum all sales for this box
    const { data: sales } = await supabase.from("ventas").select("cantidad")
      .eq("inventario_id", invId);
    const totalSoldBox = (sales ?? []).reduce((s, v) => s + v.cantidad, 0);
    const prods = invProductsMap[invId] || [];
    const totalProds = prods.reduce((s, p) => s + p.cantidad, 0) || inv.cantidad_total;
    const newEstado: Inventario["estado_caja"] = totalSoldBox >= totalProds ? "vendida" : totalSoldBox > 0 ? "parcial" : "disponible";
    await supabase.from("inventario").update({ cantidad_vendida: totalSoldBox, estado_caja: newEstado }).eq("id", invId);
    setInventario(prev => prev.map(i => i.id === invId ? { ...i, cantidad_vendida: totalSoldBox, estado_caja: newEstado } : i));
  }

  async function refreshSales() {
    const [ventasRes, creditosRes] = await Promise.all([
      supabase.from("ventas").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
        .eq("cliente_id", clienteId),
      supabase.from("creditos").select("inventario_id, variedad, tipo_caja, stem_length, color, cantidad")
        .eq("cliente_id", clienteId),
    ]);
    const sales: ProductSold[] = [];
    for (const v of (ventasRes.data ?? [])) {
      sales.push({ invId: v.inventario_id || "", variedad: v.variedad, tipo: v.tipo_caja || "", stem_length: v.stem_length || "", color: v.color || "", sold: v.cantidad });
    }
    for (const c of (creditosRes.data ?? [])) {
      sales.push({ invId: c.inventario_id || "", variedad: c.variedad, tipo: c.tipo_caja || "", stem_length: c.stem_length || "", color: c.color || "", sold: c.cantidad });
    }
    setProductSales(sales);
  }

  function getBoxProducts(inv: Inventario): BoxProduct[] { return invProductsMap[inv.id] || []; }

  // Modal title & max
  const modalTitle = sellMode?.from === "box" ? `Sell Box ${sellMode.cajaNum}`
    : sellMode?.from === "product" ? `Sell ${sellMode.variedad}`
    : sellMode?.from === "stock" ? `Sell ${sellMode.row.variedad}` : "";
  const modalMax = sellMode?.from === "product" ? sellMode.maxQty
    : sellMode?.from === "stock" ? (selectedBoxId ? (sellMode.row.boxes.find(b => b.invId === selectedBoxId)?.qty ?? 0) - (sellMode.row.boxes.find(b => b.invId === selectedBoxId)?.soldFromBox ?? 0) : sellMode.row.available)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Available", value: totalAvail, color: "text-cyan-400" },
          { label: "Sold", value: totalSold, color: "text-green-400" },
          { label: "Boxes", value: inventario.length, color: "text-purple-400" },
        ].map(s => (
          <Card key={s.label} className="text-center p-3 sm:p-5">
            <p className={`text-xl sm:text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-dim text-[10px] sm:text-xs mt-1 uppercase tracking-wider">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab("stock")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "stock" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <Package size={14} /> Stock Summary
        </button>
        <button onClick={() => setTab("shipments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${tab === "shipments" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-dim hover:text-white border border-white/5"}`}>
          <ChevronRight size={14} /> By Shipment
        </button>
      </div>

      {/* ── STOCK SUMMARY ── */}
      {tab === "stock" && (
        <Card>
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center">
            <CardTitle>Stock Summary</CardTitle>
            <div className="relative w-full sm:w-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
              <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="Search variety or color..."
                className="pl-9 pr-3 py-1.5 bg-bg border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-accent w-full sm:w-56" />
            </div>
          </CardHeader>
          {filteredStock.length === 0 && <p className="text-dim text-sm text-center py-8">No stock data</p>}
          {filteredStock.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-dim text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Variety</th><th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Color</th><th className="text-left py-2 px-3">SL</th>
                    <th className="text-right py-2 px-3">Total</th><th className="text-right py-2 px-3">Available</th>
                    <th className="text-right py-2 px-3">Sold</th><th className="text-right py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredStock.map((r, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="py-2.5 px-3 text-white font-medium">{r.variedad}</td>
                      <td className="py-2.5 px-3 text-xs text-dim capitalize">{r.tipo}</td>
                      <td className="py-2.5 px-3 text-xs text-purple-400">{r.color || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-dim">{r.stem_length || "—"}</td>
                      <td className="py-2.5 px-3 text-xs text-dim text-right">{r.total}</td>
                      <td className="py-2.5 px-3 text-xs text-cyan-400 text-right font-bold">{r.available}</td>
                      <td className="py-2.5 px-3 text-xs text-green-400 text-right">{r.sold}</td>
                      <td className="py-2.5 px-3 text-right">
                        {r.available > 0 && (
                          <button onClick={() => { resetModal(); setSellMode({ from: "stock", row: r }); }}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-2 py-1 rounded transition-all ml-auto">
                            <ShoppingCart size={12} /> Sell
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── SELL MODAL ── */}
      {sellMode && sellMode.from !== "box" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={resetModal}>
          <div className="bg-panel border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{modalTitle}</h3>
              <button onClick={resetModal} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            {sellMode.from === "product" && (
              <p className="text-xs text-dim">{sellMode.tipo} · {sellMode.color || "—"} · SL: {sellMode.stem_length || "—"} · Box {sellMode.cajaNum} · Available: {sellMode.maxQty}</p>
            )}
            {sellError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{sellError}</p>}

            {/* Stock summary: pick a box */}
            {sellMode.from === "stock" && (
              <div>
                <label className="block text-xs text-dim mb-1">Select box to deduct from</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sellMode.row.boxes.filter(b => (b.qty - b.soldFromBox) > 0).map(b => (
                    <label key={b.invId} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-xs ${
                      selectedBoxId === b.invId ? "border-cyan-400/40 bg-cyan-400/5 text-cyan-400" : "border-white/5 text-dim hover:border-white/10"
                    }`}>
                      <input type="radio" name="box" value={b.invId} checked={selectedBoxId === b.invId}
                        onChange={() => { setSelectedBoxId(b.invId); setSellQty(1); }}
                        className="accent-cyan-400" />
                      <span className="font-mono font-bold">Box {b.cajaNum}</span>
                      <span className="ml-auto">{b.qty - b.soldFromBox} available</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-dim mb-1">Quantity (max: {sellMode.from === "stock" ? (selectedBoxId ? modalMax : "—") : modalMax})</label>
              <input type="number" min={1} max={modalMax || 1} value={sellQty}
                onChange={e => setSellQty(Math.min(modalMax || 1, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Buyer</label>
              <input value={sellBuyer} onChange={e => setSellBuyer(e.target.value)} placeholder="Customer name..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Notes (optional)</label>
              <input value={sellNotes} onChange={e => setSellNotes(e.target.value)} placeholder="Any notes..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSellPagado(!sellPagado)}
                className={`relative w-10 h-5 rounded-full transition-colors ${sellPagado ? "bg-green-500" : "bg-white/10"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sellPagado ? "translate-x-5" : ""}`} />
              </button>
              <span className={`text-xs ${sellPagado ? "text-green-400" : "text-dim"}`}>{sellPagado ? "Paid" : "Pending payment"}</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSell} disabled={selling || sellQty < 1 || (sellMode.from === "stock" && !selectedBoxId)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                {selling ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Confirm Sale ({sellQty})
              </button>
              <button onClick={resetModal} className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SELL BOX CONFIRM ── */}
      {sellMode && sellMode.from === "box" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={resetModal}>
          <div className="bg-panel border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Sell Box {sellMode.cajaNum}</h3>
              <button onClick={resetModal} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-dim">This will sell all remaining products in this box:</p>
            {sellError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{sellError}</p>}
            <div className="space-y-1">
              {sellMode.products.map((p, i) => {
                const avail = availableInBox(sellMode.invId, p);
                return avail > 0 ? (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    <span className="text-white capitalize">{p.tipo}</span>
                    <span className="text-cyan-400">{p.variedad}</span>
                    <span className="text-dim">×{avail}</span>
                    {p.color && <span className="text-purple-400">{p.color}</span>}
                  </div>
                ) : null;
              })}
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Buyer</label>
              <input value={sellBuyer} onChange={e => setSellBuyer(e.target.value)} placeholder="Customer name..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Notes (optional)</label>
              <input value={sellNotes} onChange={e => setSellNotes(e.target.value)} placeholder="Any notes..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSellPagado(!sellPagado)}
                className={`relative w-10 h-5 rounded-full transition-colors ${sellPagado ? "bg-green-500" : "bg-white/10"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${sellPagado ? "translate-x-5" : ""}`} />
              </button>
              <span className={`text-xs ${sellPagado ? "text-green-400" : "text-dim"}`}>{sellPagado ? "Paid" : "Pending payment"}</span>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSell} disabled={selling}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                {selling ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                Sell Entire Box
              </button>
              <button onClick={resetModal} className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREDIT MODAL ── */}
      {creditMode && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={resetCreditModal}>
          <div className="bg-panel border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Credit — {creditMode.variedad}</h3>
              <button onClick={resetCreditModal} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-dim">{creditMode.tipo} · {creditMode.color || "—"} · SL: {creditMode.stem_length || "—"} · Box {creditMode.cajaNum} · Available: {creditMode.maxQty}</p>
            {creditError && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{creditError}</p>}
            <div>
              <label className="block text-xs text-dim mb-1">Quantity (max: {creditMode.maxQty})</label>
              <input type="number" min={1} max={creditMode.maxQty} value={creditQty}
                onChange={e => setCreditQty(Math.min(creditMode.maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Reason</label>
              <select value={creditMotivo} onChange={e => setCreditMotivo(e.target.value)}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                <option value="damaged">Damaged</option>
                <option value="unsold">Unsold</option>
                <option value="expired">Expired</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Notes (optional)</label>
              <input value={creditNotas} onChange={e => setCreditNotas(e.target.value)} placeholder="Any notes..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCredit} disabled={crediting || creditQty < 1}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                {crediting ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                Confirm Credit ({creditQty})
              </button>
              <button onClick={resetCreditModal} className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BY SHIPMENT ── */}
      {tab === "shipments" && (
        <Card>
          <CardHeader><CardTitle>Inventory by Shipment</CardTitle></CardHeader>
          {groups.length === 0 && <p className="text-dim text-sm text-center py-8">No inventory yet</p>}
          <div className="space-y-2">
            {groups.map(group => {
              const isShipOpen = expandedShip === group.key;
              const totalBoxes = group.boxes.length;
              const soldBoxes = group.boxes.filter(b => b.estado_caja === "vendida").length;
              return (
                <div key={group.key} className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => { setExpandedShip(isShipOpen ? null : group.key); setExpandedBox(null); }}>
                    {isShipOpen ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-dim" />}
                    <span className="text-xs font-mono text-cyan-400">{group.info.fecha}</span>
                    <span className="text-xs text-dim">HAWB: {group.info.hawb || "—"}</span>
                    <span className="text-xs text-dim">AWB: {group.info.awb || "—"}</span>
                    <span className="ml-auto text-xs text-purple-400">{totalBoxes} box{totalBoxes !== 1 ? "es" : ""}</span>
                    {soldBoxes > 0 && <span className="text-xs text-green-400">{soldBoxes} sold</span>}
                  </div>
                  {isShipOpen && (
                    <div className="border-t border-white/5 bg-bg/30 px-4 py-2 space-y-2">
                      {group.boxes.map(inv => {
                        const isBoxOpen = expandedBox === inv.id;
                        const prods = getBoxProducts(inv);
                        const allSold = prods.length > 0 && prods.every(p => availableInBox(inv.id, p) <= 0);
                        return (
                          <div key={inv.id} className="border border-white/5 rounded-lg overflow-hidden">
                            <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/3 transition-colors"
                              onClick={() => setExpandedBox(isBoxOpen ? null : inv.id)}>
                              {isBoxOpen ? <ChevronDown size={12} className="text-cyan-400" /> : <ChevronRight size={12} className="text-dim" />}
                              <span className="text-xs font-mono text-cyan-400 font-bold w-14">Box {inv.caja_numero ?? "—"}</span>
                              <span className="text-xs text-white flex-1">{inv.variedad || "—"}</span>
                              <span className="text-xs text-dim capitalize">{inv.tipo_caja}</span>
                              <Badge estado={allSold ? "vendida" : inv.estado_caja} />
                              {!allSold && prods.length > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); resetModal();
                                  setSellMode({ from: "box", invId: inv.id, cajaNum: inv.caja_numero ?? 0, products: prods }); }}
                                  className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-2 py-1 rounded transition-all">
                                  <ShoppingCart size={10} /> Sell
                                </button>
                              )}
                            </div>
                            {isBoxOpen && (
                              <div className="border-t border-white/5 bg-bg/50 px-4 py-3 space-y-2">
                                {prods.length > 0 ? (
                                  <div className="space-y-1">
                                    <p className="text-xs text-dim uppercase tracking-wider mb-1">Contents</p>
                                    {prods.map((p, pi) => {
                                      const avail = availableInBox(inv.id, p);
                                      const soldP = soldFromBox(inv.id, p.variedad, p.tipo);
                                      return (
                                        <div key={pi} className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs py-1 border-b border-white/5 last:border-0">
                                          <span className="text-white capitalize font-medium">{p.tipo}</span>
                                          <span className="text-cyan-400">{p.variedad}</span>
                                          <span className="text-dim">×{p.cantidad}</span>
                                          {soldP > 0 && <span className="text-green-400">({soldP} sold)</span>}
                                          {p.stem_length && <span className="text-dim">SL: {p.stem_length}</span>}
                                          {p.color && <span className="text-purple-400">{p.color}</span>}
                                          <div className="flex items-center gap-1 ml-auto">
                                          {avail > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); resetModal();
                                              setSellMode({ from: "product", invId: inv.id, cajaNum: inv.caja_numero ?? 0, variedad: p.variedad, tipo: p.tipo, stem_length: p.stem_length, color: p.color, maxQty: avail }); }}
                                              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-1.5 py-0.5 rounded transition-all">
                                              <ShoppingCart size={10} /> Sell ({avail})
                                            </button>
                                          )}
                                          {avail > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); resetCreditModal();
                                              setCreditMode({ invId: inv.id, cajaNum: inv.caja_numero ?? 0, variedad: p.variedad, tipo: p.tipo, stem_length: p.stem_length, color: p.color, maxQty: avail }); }}
                                              className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-400/20 hover:border-yellow-400/40 px-1.5 py-0.5 rounded transition-all">
                                              <AlertTriangle size={10} /> Credit
                                            </button>
                                          )}
                                          {avail <= 0 && <span className="text-xs text-green-400/60">Sold</span>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-dim italic">No product details available</p>
                                )}
                                {inv.notas && <p className="text-xs text-dim mt-1">{inv.notas}</p>}
                                {!allSold && prods.length > 0 && (
                                  <div className="pt-2 border-t border-white/5">
                                    <button onClick={(e) => { e.stopPropagation(); resetModal();
                                      setSellMode({ from: "box", invId: inv.id, cajaNum: inv.caja_numero ?? 0, products: prods }); }}
                                      className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-2.5 py-1.5 rounded-lg transition-all">
                                      <ShoppingCart size={12} /> Sell Box {inv.caja_numero ?? ""}
                                    </button>
                                  </div>
                                )}
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
        </Card>
      )}
    </div>
  );
}
