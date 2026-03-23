"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { Variedad } from "@/lib/types";
import { Plus, Trash2, Search, Check, Loader2, X, Package, AlertTriangle, Pencil, ArrowRight, RotateCcw } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";

type BoncheLine = { variedad_id: string; variedad_nombre: string; color: string; cantidad: number };

type BoxOrder = {
  mode: "solid" | "personalized";
  tipo_caja: "bouquet" | "bonche";
  categoria: "color" | "rojo";
  cantidad_cajas: number;
  variedad_id: string;
  variedad_nombre: string;
  lines: BoncheLine[];
  stem_length: string;
  notas: string;
  customDist: DistributedBox[] | null; // manual box overrides
};

const STEMS_BONCHE = 25;
const STEMS_BOUQUET = 12;
const BOX_CAPACITY = 300;
const BONCHES_PER_BOX = 12;
const BOUQUETS_PER_BOX = 25;

function emptyBox(): BoxOrder {
  return {
    mode: "solid", tipo_caja: "bouquet", categoria: "color",
    cantidad_cajas: 1, variedad_id: "", variedad_nombre: "",
    lines: [], stem_length: "50cm", notas: "", customDist: null,
  };
}

/* Auto-distribute bonche lines into boxes of 12 */
type DistributedBox = { lines: { variedad_id: string; variedad_nombre: string; color: string; cantidad: number }[] };
function distributeIntoBoxes(lines: BoncheLine[]): DistributedBox[] {
  if (lines.length === 0) return [];
  const flat: { variedad_id: string; variedad_nombre: string; color: string }[] = [];
  for (const l of lines) {
    for (let j = 0; j < l.cantidad; j++) flat.push({ variedad_id: l.variedad_id, variedad_nombre: l.variedad_nombre, color: l.color });
  }
  const boxes: DistributedBox[] = [];
  for (let i = 0; i < flat.length; i += BONCHES_PER_BOX) {
    const chunk = flat.slice(i, i + BONCHES_PER_BOX);
    const map = new Map<string, { variedad_id: string; variedad_nombre: string; color: string; cantidad: number }>();
    for (const item of chunk) {
      const key = item.variedad_id;
      if (!map.has(key)) map.set(key, { ...item, cantidad: 0 });
      map.get(key)!.cantidad++;
    }
    boxes.push({ lines: Array.from(map.values()) });
  }
  return boxes;
}

export default function OrderForm({ clienteId, variedades }: { clienteId: string; variedades: Variedad[] }) {
  const [open, setOpen] = useState(false);
  const [fechaSalida, setFechaSalida] = useState("");
  const [notas, setNotas] = useState("");
  const [boxes, setBoxes] = useState<BoxOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingBox, setEditingBox] = useState<{ orderIdx: number; boxIdx: number } | null>(null);
  const [moveFrom, setMoveFrom] = useState<{ orderIdx: number; boxIdx: number; variedadId: string } | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen !== null && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }, []);

  function addBox() { setBoxes(prev => [...prev, emptyBox()]); }
  function updateBox(i: number, patch: Partial<BoxOrder>) {
    setBoxes(prev => prev.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }
  function removeBox(i: number) {
    setBoxes(prev => prev.filter((_, idx) => idx !== i));
    if (searchOpen === i) setSearchOpen(null);
    if (editingBox?.orderIdx === i) setEditingBox(null);
    if (moveFrom?.orderIdx === i) setMoveFrom(null);
  }
  function setMode(i: number, mode: "solid" | "personalized") {
    setBoxes(prev => prev.map((b, idx) => {
      if (idx !== i) return b;
      if (mode === "personalized") return { ...b, mode, tipo_caja: "bonche" as const, lines: b.lines.length > 0 ? b.lines : [], customDist: null };
      return { ...b, mode, lines: [], customDist: null };
    }));
    setEditingBox(null);
    setMoveFrom(null);
  }

  function addVarietyLine(boxIdx: number, v: Variedad, qty: number) {
    const clamped = Math.max(0, qty);
    setBoxes(prev => prev.map((b, idx) => {
      if (idx !== boxIdx) return b;
      const existing = b.lines.findIndex(l => l.variedad_id === v.id);
      if (existing >= 0) {
        const updated = [...b.lines];
        updated[existing] = { ...updated[existing], cantidad: clamped };
        return { ...b, lines: updated.filter(l => l.cantidad > 0), customDist: null };
      }
      if (clamped <= 0) return b;
      return { ...b, lines: [...b.lines, { variedad_id: v.id, variedad_nombre: v.nombre, color: v.color || "", cantidad: clamped }], customDist: null };
    }));
  }
  function removeVarietyLine(boxIdx: number, variedadId: string) {
    setBoxes(prev => prev.map((b, idx) => idx !== boxIdx ? b : { ...b, lines: b.lines.filter(l => l.variedad_id !== variedadId), customDist: null }));
  }
  function updateLineQty(boxIdx: number, variedadId: string, qty: number) {
    const clamped = Math.max(0, qty);
    setBoxes(prev => prev.map((b, idx) => {
      if (idx !== boxIdx) return b;
      return { ...b, lines: b.lines.map(l => l.variedad_id === variedadId ? { ...l, cantidad: clamped } : l).filter(l => l.cantidad > 0), customDist: null };
    }));
  }

  // ── Custom distribution helpers ──
  function startEditDist(orderIdx: number) {
    setBoxes(prev => prev.map((b, idx) => {
      if (idx !== orderIdx || b.mode !== "personalized") return b;
      if (b.customDist) return b; // already has custom
      return { ...b, customDist: distributeIntoBoxes(b.lines) };
    }));
  }
  function resetDist(orderIdx: number) {
    setBoxes(prev => prev.map((b, idx) => idx === orderIdx ? { ...b, customDist: null } : b));
    setEditingBox(null);
    setMoveFrom(null);
  }
  function updateDistLineQty(orderIdx: number, boxIdx: number, variedadId: string, newQty: number) {
    setBoxes(prev => prev.map((b, oi) => {
      if (oi !== orderIdx || !b.customDist) return b;
      const dist = b.customDist.map((db, bi) => {
        if (bi !== boxIdx) return db;
        const lines = db.lines.map(l => l.variedad_id === variedadId ? { ...l, cantidad: Math.max(0, newQty) } : l).filter(l => l.cantidad > 0);
        return { lines };
      });
      return { ...b, customDist: dist.filter(db => db.lines.length > 0) };
    }));
  }
  function moveVarietyToBox(orderIdx: number, fromBox: number, toBox: number, variedadId: string, qty: number) {
    if (qty <= 0) return;
    setBoxes(prev => prev.map((b, oi) => {
      if (oi !== orderIdx || !b.customDist) return b;
      const dist = [...b.customDist.map(db => ({ lines: db.lines.map(l => ({ ...l })) }))];
      // Remove from source
      const srcLine = dist[fromBox]?.lines.find(l => l.variedad_id === variedadId);
      if (!srcLine || srcLine.cantidad < qty) return b;
      srcLine.cantidad -= qty;
      dist[fromBox].lines = dist[fromBox].lines.filter(l => l.cantidad > 0);
      // Ensure target box exists
      while (dist.length <= toBox) dist.push({ lines: [] });
      // Add to target
      const tgtLine = dist[toBox].lines.find(l => l.variedad_id === variedadId);
      if (tgtLine) { tgtLine.cantidad += qty; }
      else { dist[toBox].lines.push({ ...srcLine, cantidad: qty }); }
      return { ...b, customDist: dist.filter(db => db.lines.length > 0) };
    }));
    setMoveFrom(null);
    setEditingBox(null);
  }
  function addNewBoxToDist(orderIdx: number) {
    setBoxes(prev => prev.map((b, oi) => {
      if (oi !== orderIdx || !b.customDist) return b;
      return { ...b, customDist: [...b.customDist, { lines: [] }] };
    }));
  }

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return variedades;
    const q = searchTerm.toLowerCase();
    return variedades.filter(v => v.nombre.toLowerCase().includes(q) || (v.color || "").toLowerCase().includes(q));
  }, [searchTerm, variedades]);

  // Totals
  const totalStems = boxes.reduce((s, b) => {
    if (b.mode === "solid") {
      const units = b.tipo_caja === "bouquet" ? BOUQUETS_PER_BOX : BONCHES_PER_BOX;
      const stems = b.tipo_caja === "bouquet" ? STEMS_BOUQUET : STEMS_BONCHE;
      return s + b.cantidad_cajas * units * stems;
    }
    return s + b.lines.reduce((ss, l) => ss + l.cantidad, 0) * STEMS_BONCHE;
  }, 0);
  const totalBoxCount = boxes.reduce((s, b) => {
    if (b.mode === "solid") return s + b.cantidad_cajas;
    if (b.customDist) return s + b.customDist.length;
    const bonches = b.lines.reduce((ss, l) => ss + l.cantidad, 0);
    return s + (bonches > 0 ? Math.ceil(bonches / BONCHES_PER_BOX) : 0);
  }, 0);

  // Check if any personalized order has an incomplete last box
  const hasIncompleteBox = boxes.some(b => {
    if (b.mode !== "personalized") return false;
    if (b.customDist) {
      return b.customDist.some(db => {
        const total = db.lines.reduce((s, l) => s + l.cantidad, 0);
        return total > 0 && total !== BONCHES_PER_BOX;
      });
    }
    const total = b.lines.reduce((s, l) => s + l.cantidad, 0);
    return total > 0 && total % BONCHES_PER_BOX !== 0;
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fechaSalida || boxes.length === 0) return;
    setSaving(true);
    const { data: orden, error } = await supabase.from("ordenes").insert({
      cliente_id: clienteId, fecha_salida_finca: fechaSalida, notas,
    }).select().single();
    if (error || !orden) { setSaving(false); return; }

    const rows: Record<string, unknown>[] = [];
    for (const b of boxes) {
      if (b.mode === "solid") {
        rows.push({
          orden_id: orden.id, tipo_caja: b.tipo_caja, categoria: b.categoria,
          variedad_id: b.variedad_id || null,
          variedad_nombre: b.variedad_nombre || `Solid ${b.categoria}`,
          cantidad_cajas: b.cantidad_cajas,
          stems_por_caja: b.tipo_caja === "bouquet" ? STEMS_BOUQUET : STEMS_BONCHE,
          stem_length: b.stem_length || null, notas: b.notas || null,
        });
      } else {
        // Personalized: use custom distribution if set, otherwise auto
        const dist = b.customDist ?? distributeIntoBoxes(b.lines);
        for (const db of dist) {
          for (const line of db.lines) {
            rows.push({
              orden_id: orden.id, tipo_caja: "bonche", categoria: "color",
              variedad_id: line.variedad_id || null, variedad_nombre: line.variedad_nombre,
              cantidad_cajas: line.cantidad, stems_por_caja: STEMS_BONCHE,
              stem_length: b.stem_length || null, notas: b.notas || null,
            });
          }
        }
      }
    }
    if (rows.length > 0) await supabase.from("orden_items").insert(rows);
    setSaving(false); setOpen(false); setBoxes([]); setFechaSalida(""); setNotas("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Order</CardTitle>
        <button onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-lg transition-all">
          <Plus size={14} /> Create Order
        </button>
      </CardHeader>

      {open && (
        <form onSubmit={submit} className="space-y-4 animate-fade-in">
          <div>
            <label className="block text-xs text-dim mb-1.5 uppercase tracking-wider">Farm Departure Date *</label>
            <DatePicker value={fechaSalida} onChange={setFechaSalida} placeholder="Select departure date..." minDate={minDate} />
            <p className="text-xs text-dim mt-1">Minimum 2 days from today</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-dim uppercase tracking-wider">Boxes</p>

            {boxes.map((box, i) => {
              const totalBonches = box.lines.reduce((s, l) => s + l.cantidad, 0);
              const distributed = box.mode === "personalized" ? distributeIntoBoxes(box.lines) : [];

              return (
                <div key={i} className="bg-bg border border-white/5 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-cyan-400">
                      {box.mode === "solid" ? `Box ${i + 1}` : `Order ${i + 1}`}
                    </span>
                    <button type="button" onClick={() => removeBox(i)} className="text-dim hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Mode toggle */}
                  <div>
                    <label className="block text-xs text-dim mb-1">Mode</label>
                    <div className="flex gap-2">
                      {(["solid", "personalized"] as const).map(m => (
                        <button key={m} type="button" onClick={() => setMode(i, m)}
                          className={cn("flex-1 py-2 rounded text-xs border transition-all",
                            box.mode === m ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "border-white/10 text-dim hover:border-white/20")}>
                          {m === "solid" ? "Solid" : "Personalized"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── SOLID ── */}
                  {box.mode === "solid" && (<>
                    <div>
                      <label className="block text-xs text-dim mb-1">Type</label>
                      <div className="flex gap-2">
                        {(["bouquet", "bonche"] as const).map(t => (
                          <button key={t} type="button" onClick={() => updateBox(i, { tipo_caja: t })}
                            className={cn("flex-1 py-1.5 rounded text-xs border transition-all",
                              box.tipo_caja === t ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400" : "border-white/10 text-dim hover:border-white/20")}>
                            {t === "bouquet" ? `Bouquet (${BOUQUETS_PER_BOX}×${STEMS_BOUQUET})` : `Bonche (${BONCHES_PER_BOX}×${STEMS_BONCHE})`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-dim mb-1">Category</label>
                      <div className="flex gap-2">
                        {(["color", "rojo"] as const).map(c => (
                          <button key={c} type="button" onClick={() => updateBox(i, { categoria: c })}
                            className={cn("flex-1 py-1.5 rounded text-xs border transition-all",
                              box.categoria === c ? "bg-purple-500/20 border-purple-500/40 text-purple-400" : "border-white/10 text-dim hover:border-white/20")}>
                            {c === "rojo" ? "Red" : "Color"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {box.tipo_caja === "bonche" && (
                      <div>
                        <label className="block text-xs text-dim mb-1">Variety (optional)</label>
                        <select value={box.variedad_id}
                          onChange={e => { const v = variedades.find(v => v.id === e.target.value); updateBox(i, { variedad_id: e.target.value, variedad_nombre: v?.nombre ?? "" }); }}
                          className="w-full bg-bg border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
                          <option value="">— Any variety —</option>
                          {variedades.map(v => <option key={v.id} value={v.id}>{v.nombre}{v.color ? ` (${v.color})` : ""}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-dim mb-1">Number of boxes</label>
                        <input type="number" min={1} value={box.cantidad_cajas}
                          onChange={e => updateBox(i, { cantidad_cajas: parseInt(e.target.value) || 1 })}
                          className="w-full bg-bg border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                      </div>
                      <div>
                        <label className="block text-xs text-dim mb-1">Stem Length</label>
                        <input type="text" value={box.stem_length} onChange={e => updateBox(i, { stem_length: e.target.value })}
                          className="w-full bg-bg border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                      </div>
                    </div>
                    <p className="text-xs text-cyan-400 font-mono">
                      = {box.cantidad_cajas} box{box.cantidad_cajas !== 1 ? "es" : ""} × {BOX_CAPACITY} = {box.cantidad_cajas * BOX_CAPACITY} stems
                    </p>
                  </>)}

                  {/* ── PERSONALIZED ── */}
                  {box.mode === "personalized" && (<>
                    {/* Selected varieties */}
                    {box.lines.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-dim uppercase tracking-wider">Varieties</p>
                        {box.lines.map(line => (
                          <div key={line.variedad_id} className="flex items-center gap-2 bg-panel border border-white/5 rounded-lg px-3 py-2">
                            <span className="text-sm text-white flex-1">{line.variedad_nombre}</span>
                            {line.color && <span className="text-xs text-purple-400">{line.color}</span>}
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => updateLineQty(i, line.variedad_id, line.cantidad - 1)}
                                className="w-7 h-7 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-sm">−</button>
                              <input type="number" min={1} value={line.cantidad}
                                onChange={e => updateLineQty(i, line.variedad_id, parseInt(e.target.value) || 0)}
                                className="w-14 text-center bg-bg border border-white/10 rounded px-1 py-1 text-sm text-cyan-400 font-bold focus:outline-none focus:border-accent" />
                              <button type="button" onClick={() => updateLineQty(i, line.variedad_id, line.cantidad + 1)}
                                className="w-7 h-7 flex items-center justify-center text-dim hover:text-white border border-white/10 rounded text-sm">+</button>
                            </div>
                            <button type="button" onClick={() => removeVarietyLine(i, line.variedad_id)}
                              className="text-dim hover:text-red-400 ml-1"><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search picker */}
                    {searchOpen === i ? (
                      <div className="border border-cyan-400/20 bg-cyan-400/5 rounded-lg p-3 space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                            <input ref={searchRef} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                              placeholder="Search variety..."
                              className="w-full pl-9 pr-3 py-2 bg-bg border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent" />
                          </div>
                          <button type="button" onClick={() => { setSearchOpen(null); setSearchTerm(""); }}
                            className="text-dim hover:text-white p-1"><X size={16} /></button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {searchResults.map(v => {
                            const existing = box.lines.find(l => l.variedad_id === v.id);
                            const qty = existing?.cantidad ?? 0;
                            return (
                              <div key={v.id} className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                                qty > 0 ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/5 hover:border-white/10"
                              )}>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-white">{v.nombre}</span>
                                  {v.color && <span className="text-xs text-purple-400 ml-2">{v.color}</span>}
                                </div>
                                <input type="number" min={0} value={qty}
                                  onChange={e => addVarietyLine(i, v, parseInt(e.target.value) || 0)}
                                  className="w-14 text-center bg-bg border border-white/10 rounded px-1 py-1 text-sm font-bold focus:outline-none focus:border-accent text-cyan-400" />
                              </div>
                            );
                          })}
                          {searchResults.length === 0 && <p className="text-xs text-dim text-center py-4">No varieties found</p>}
                        </div>
                        <button type="button" onClick={() => { setSearchOpen(null); setSearchTerm(""); }}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs transition-all">
                          <Check size={14} /> Done
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setSearchOpen(i); setSearchTerm(""); }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-white/10 hover:border-cyan-400/30 rounded-lg text-xs text-dim hover:text-cyan-400 transition-all">
                        <Plus size={14} /> Add varieties
                      </button>
                    )}

                    <div>
                      <label className="block text-xs text-dim mb-1">Stem Length</label>
                      <input type="text" value={box.stem_length} onChange={e => updateBox(i, { stem_length: e.target.value })}
                        className="w-full bg-bg border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                    </div>

                    {/* Auto-distribution preview */}
                    {totalBonches > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2">
                          <div className="text-xs font-mono">
                            <span className="text-dim">Total: </span>
                            <span className="text-cyan-400 font-bold">{totalBonches} bonches</span>
                            <span className="text-dim"> → </span>
                            <span className="text-purple-400 font-bold">{(box.customDist ?? distributed).length} box{(box.customDist ?? distributed).length !== 1 ? "es" : ""}</span>
                            <span className="text-dim"> ({totalBonches * STEMS_BONCHE} stems)</span>
                          </div>
                          <div className="flex gap-1">
                            {!box.customDist ? (
                              <button type="button" onClick={() => startEditDist(i)}
                                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-400/20 hover:border-purple-400/40 rounded px-2 py-1 transition-all">
                                <Pencil size={12} /> Edit boxes
                              </button>
                            ) : (
                              <button type="button" onClick={() => resetDist(i)}
                                className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 border border-amber-400/20 hover:border-amber-400/40 rounded px-2 py-1 transition-all">
                                <RotateCcw size={12} /> Auto-distribute
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Box list */}
                        {(box.customDist ?? distributed).length > 0 && (
                          <div className="space-y-1">
                            {(box.customDist ?? distributed).map((db, bi) => {
                              const boxBonches = db.lines.reduce((s, l) => s + l.cantidad, 0);
                              const isIncomplete = boxBonches !== BONCHES_PER_BOX;
                              const missing = BONCHES_PER_BOX - boxBonches;
                              const isEditing = editingBox?.orderIdx === i && editingBox?.boxIdx === bi;

                              return (
                                <div key={bi} className={cn(
                                  "rounded-lg px-3 py-2 transition-all",
                                  isEditing ? "bg-purple-400/10 border-2 border-purple-400/40" :
                                  isIncomplete ? "bg-red-400/5 border border-red-400/20" : "bg-panel/50 border border-white/5"
                                )}>
                                  <div className="flex items-start gap-2">
                                    <Package size={14} className={cn("mt-0.5 flex-shrink-0", isIncomplete ? "text-red-400" : "text-purple-400")} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className={cn("text-xs font-mono font-bold", isIncomplete ? "text-red-400" : "text-purple-400")}>Box {bi + 1}</span>
                                          <span className="text-xs text-dim ml-2">({boxBonches}/{BONCHES_PER_BOX})</span>
                                        </div>
                                        {box.customDist && (
                                          <button type="button"
                                            onClick={() => setEditingBox(isEditing ? null : { orderIdx: i, boxIdx: bi })}
                                            className={cn("text-xs px-2 py-0.5 rounded border transition-all",
                                              isEditing ? "text-purple-400 border-purple-400/40 bg-purple-400/10" : "text-dim hover:text-white border-white/10 hover:border-white/20")}>
                                            {isEditing ? "Done" : "Edit"}
                                          </button>
                                        )}
                                      </div>

                                      {/* Variety lines */}
                                      {!isEditing ? (
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                          {db.lines.map((l, li) => (
                                            <span key={li} className="text-xs">
                                              <span className="text-white">{l.variedad_nombre}</span>
                                              <span className="text-cyan-400 ml-1">×{l.cantidad}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="mt-2 space-y-1">
                                          {db.lines.map(l => (
                                            <div key={l.variedad_id} className="flex items-center gap-2 bg-bg/50 rounded px-2 py-1.5">
                                              <span className="text-xs text-white flex-1 truncate">{l.variedad_nombre}</span>
                                              <input type="number" min={0} max={BONCHES_PER_BOX} value={l.cantidad}
                                                onChange={e => updateDistLineQty(i, bi, l.variedad_id, parseInt(e.target.value) || 0)}
                                                className="w-14 text-center bg-bg border border-white/10 rounded px-1 py-1 text-xs text-cyan-400 font-bold focus:outline-none focus:border-accent" />
                                              <button type="button"
                                                onClick={() => setMoveFrom(moveFrom?.variedadId === l.variedad_id && moveFrom?.boxIdx === bi ? null : { orderIdx: i, boxIdx: bi, variedadId: l.variedad_id })}
                                                className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded border transition-all",
                                                  moveFrom?.variedadId === l.variedad_id && moveFrom?.boxIdx === bi
                                                    ? "text-amber-400 border-amber-400/40 bg-amber-400/10"
                                                    : "text-dim hover:text-cyan-400 border-white/10 hover:border-cyan-400/30")}>
                                                <ArrowRight size={12} /> Move
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Move target indicator */}
                                      {moveFrom && moveFrom.orderIdx === i && moveFrom.boxIdx !== bi && (
                                        <button type="button"
                                          onClick={() => moveVarietyToBox(i, moveFrom.boxIdx, bi, moveFrom.variedadId, 1)}
                                          className="mt-1 w-full flex items-center justify-center gap-1 text-xs text-amber-400 border border-dashed border-amber-400/30 hover:border-amber-400/60 bg-amber-400/5 hover:bg-amber-400/10 rounded px-2 py-1.5 transition-all">
                                          <Plus size={12} /> Move 1 bonche here
                                        </button>
                                      )}

                                      {isIncomplete && !isEditing && (
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                          <AlertTriangle size={12} className="text-red-400" />
                                          <span className="text-xs text-red-400">
                                            {missing > 0 ? `Needs ${missing} more bonche${missing !== 1 ? "s" : ""}` : `Over by ${-missing} bonche${missing !== -1 ? "s" : ""}`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Add empty box button in custom mode */}
                            {box.customDist && (
                              <button type="button" onClick={() => addNewBoxToDist(i)}
                                className="w-full flex items-center justify-center gap-1 text-xs text-dim hover:text-purple-400 border border-dashed border-white/10 hover:border-purple-400/30 rounded-lg px-2 py-2 transition-all">
                                <Plus size={12} /> Add empty box
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>)}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs text-dim mb-1">Special notes</label>
                    <input type="text" placeholder="Special request..." value={box.notas}
                      onChange={e => updateBox(i, { notas: e.target.value })}
                      className="w-full bg-bg border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                  </div>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={addBox}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-purple-400/30 hover:border-purple-400/60 bg-purple-400/5 hover:bg-purple-400/10 rounded-xl text-sm text-purple-400 hover:text-purple-300 transition-all">
            <Plus size={18} /> Add Box
          </button>

          <div>
            <label className="block text-xs text-dim mb-1.5 uppercase tracking-wider">Order notes</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} placeholder="Additional instructions..."
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent resize-none" />
          </div>

          {boxes.length > 0 && (
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-4 py-3 font-mono text-sm">
              <span className="text-dim">Total: </span>
              <span className="text-cyan-400 font-bold">{totalStems} stems</span>
              <span className="text-dim"> in {totalBoxCount} box{totalBoxCount !== 1 ? "es" : ""}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={saving || !fechaSalida || boxes.length === 0 || hasIncompleteBox}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:opacity-40 text-black font-bold py-2.5 rounded-lg transition-all text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Submitting..." : "Submit Order"}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
