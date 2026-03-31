"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { CajaItem, Variedad } from "@/lib/types";
import {
  ChevronDown, ChevronRight, Save,
  Upload, Download, Pencil, Plus, Trash2, Loader2, X,
  CheckSquare, Square, Layers,
} from "lucide-react";

type ClienteMin = { id: string; nombre: string; empresa?: string };

type Exportacion = {
  id: string;
  export_id: string;
  cliente: string;
  cliente_id: string | null;
  fecha: string;
  hawb: string;
  awb: string;
  origen: string;
  destino: string;
  pais: string;
  dae: string;
  hbs: string;
  variedad: string;
  productos: unknown[];
  cajas: CajaItem[];
  qr_token: string;
  created_at: string;
};

type BoxDetail = {
  tipo: "bouquet" | "bonche";
  variedad: string;
  cantidad: number;
  stem_length: string;
  color: string;
};

/* Group shipments: Client → DateGroup(fecha+hawb+awb) → boxes */
type DateGroup = { fecha: string; hawb: string; awb: string; shipments: Exportacion[] };
type ClientGroup = { clienteId: string; clienteName: string; dates: DateGroup[] };

function groupShipments(shipments: Exportacion[], clientes: ClienteMin[]): ClientGroup[] {
  const clientMap = new Map<string, { name: string; ships: Exportacion[] }>();
  for (const s of shipments) {
    const key = s.cliente_id || s.cliente || "unknown";
    if (!clientMap.has(key)) {
      const cl = clientes.find(c => c.id === s.cliente_id);
      clientMap.set(key, { name: cl?.nombre || s.cliente || "Unknown", ships: [] });
    }
    clientMap.get(key)!.ships.push(s);
  }

  const groups: ClientGroup[] = [];
  for (const [cid, { name, ships }] of clientMap) {
    const dateMap = new Map<string, DateGroup>();
    for (const s of ships) {
      const dkey = `${s.fecha}|${s.hawb}|${s.awb}`;
      if (!dateMap.has(dkey)) {
        dateMap.set(dkey, { fecha: s.fecha, hawb: s.hawb, awb: s.awb, shipments: [] });
      }
      dateMap.get(dkey)!.shipments.push(s);
    }
    // Sort date groups by fecha desc
    const dates = Array.from(dateMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
    groups.push({ clienteId: cid, clienteName: name, dates });
  }
  return groups.sort((a, b) => a.clienteName.localeCompare(b.clienteName));
}

function parseCajas(raw: unknown): CajaItem[] {
  if (Array.isArray(raw)) return raw as CajaItem[];
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}

/* ── Variety search/select combo ── */
function VarietyPicker({ variedades, value, onChange, onColorFill }: {
  variedades: Variedad[];
  value: string;
  onChange: (v: string) => void;
  onColorFill: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = variedades.filter(v =>
    v.activo && v.nombre.toLowerCase().includes(search.toLowerCase())
  );

  function pick(v: Variedad) {
    onChange(v.nombre);
    setSearch(v.nombre);
    if (v.color) onColorFill(v.color);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Variety..."
        className="w-full bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-panel border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(v => (
            <button key={v.id} onClick={() => pick(v)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2">
              <span className="text-white">{v.nombre}</span>
              {v.color && <span className="text-dim">({v.color})</span>}
              <span className={`ml-auto text-xs ${v.tipo === "rojo" ? "text-red-400" : "text-purple-400"}`}>
                {v.tipo}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShipmentsAdmin({ clientes }: { clientes: ClienteMin[] }) {
  const supabase = createClient();
  const [shipments, setShipments] = useState<Exportacion[]>([]);
  const [variedades, setVariedades] = useState<Variedad[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [editingBox, setEditingBox] = useState<{ shipId: string; boxIdx: number } | null>(null);
  const [boxDetails, setBoxDetails] = useState<BoxDetail[]>([]);
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set()); // "shipId|boxIdx"
  const [bulkDetails, setBulkDetails] = useState<BoxDetail[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  // New shipment not needed — shipments come from Pilot X
  // Auto-linking is handled by DB triggers matching exportaciones.cliente ↔ clientes.empresa

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ships }, { data: vars }] = await Promise.all([
      supabase.from("exportaciones").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("variedades").select("*").eq("activo", true).order("nombre"),
    ]);
    setShipments((ships as Exportacion[]) ?? []);
    setVariedades((vars as Variedad[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const groups = groupShipments(shipments, clientes);

  function toggleClient(id: string) {
    setExpandedClient(prev => prev === id ? null : id);
    setExpandedDate(null);
    setEditingBox(null);
  }

  function toggleDate(key: string) {
    setExpandedDate(prev => prev === key ? null : key);
    setEditingBox(null);
  }

  function getBoxStemCount(shipId: string, boxIdx: number): number {
    const ship = shipments.find(s => s.id === shipId);
    if (!ship) return 25;
    const cajas = parseCajas(ship.cajas);
    const box = cajas[boxIdx];
    const titulo = String(box?.titulo ?? "").toLowerCase();
    return titulo.includes("bonche") ? 25 : titulo.includes("bouquet") ? 12 : 25;
  }

  function startEditBox(ship: Exportacion, boxIdx: number) {
    const cajas = parseCajas(ship.cajas);
    const box = cajas[boxIdx];
    const existing = Array.isArray(box?.productos) ? (box.productos as BoxDetail[]) : [];
    const stemLen = box?.stem_length || "";
    const defaultQty = getBoxStemCount(ship.id, boxIdx);
    setBoxDetails(existing.length > 0 ? existing : [{
      tipo: "bouquet", variedad: "", cantidad: defaultQty, stem_length: stemLen, color: "",
    }]);
    setEditingBox({ shipId: ship.id, boxIdx });
  }

  function addDetail() {
    const stemLen = editingBox ? (() => {
      const ship = shipments.find(s => s.id === editingBox.shipId);
      if (!ship) return "";
      const cajas = parseCajas(ship.cajas);
      return cajas[editingBox.boxIdx]?.stem_length || "";
    })() : "";
    setBoxDetails(prev => [...prev, { tipo: "bouquet", variedad: "", cantidad: 1, stem_length: stemLen, color: "" }]);
  }

  function updateDetail(idx: number, field: keyof BoxDetail, value: string | number) {
    setBoxDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  function removeDetail(idx: number) {
    setBoxDetails(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveDetails() {
    if (!editingBox) return;
    setSaving(true);
    const ship = shipments.find(s => s.id === editingBox.shipId);
    if (!ship) { setSaving(false); return; }

    const cajas = parseCajas(ship.cajas);
    if (cajas[editingBox.boxIdx]) {
      (cajas[editingBox.boxIdx] as CajaItem & { productos?: BoxDetail[] }).productos = boxDetails;
    }

    await supabase.from("exportaciones")
      .update({ cajas: cajas as unknown as Record<string, unknown>[] })
      .eq("id", ship.id);
    if (ship.export_id) {
      await supabase.from("coordinaciones")
        .update({ cajas: cajas as unknown as Record<string, unknown>[] })
        .eq("export_id", ship.export_id);
    }

    setShipments(prev => prev.map(s => s.id === ship.id ? { ...s, cajas } : s));
    setEditingBox(null);
    setSaving(false);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("");
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: Record<string, string>[];
      if (ext === "json") {
        rows = JSON.parse(text);
        if (!Array.isArray(rows)) throw new Error("JSON must be an array");
      } else {
        const lines = text.trim().split("\n");
        if (lines.length < 2) throw new Error("CSV needs header + data");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        rows = lines.slice(1).map(line => {
          const vals = line.split(",").map(v => v.trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
          return obj;
        });
      }
      let updated = 0;
      for (const row of rows) {
        const hawb = String(row.hawb || "").trim();
        const cajaNum = parseInt(String(row.caja || row.box || "0"));
        if (!hawb || !cajaNum) continue;
        const ship = shipments.find(s => s.hawb === hawb);
        if (!ship) continue;
        const cajas = parseCajas(ship.cajas);
        const boxIdx = cajas.findIndex(c => Number(c.caja) === cajaNum);
        if (boxIdx === -1) continue;
        const detail: BoxDetail = {
          tipo: (String(row.tipo || "bouquet").toLowerCase()) as "bouquet" | "bonche",
          variedad: String(row.variedad || ""),
          cantidad: parseInt(String(row.cantidad || "1")) || 1,
          stem_length: String(row.stem_length || ""),
          color: String(row.color || ""),
        };
        const box = cajas[boxIdx] as CajaItem & { productos?: BoxDetail[] };
        if (!box.productos) box.productos = [];
        (box.productos as BoxDetail[]).push(detail);
        await supabase.from("exportaciones")
          .update({ cajas: cajas as unknown as Record<string, unknown>[] }).eq("id", ship.id);
        if (ship.export_id) {
          await supabase.from("coordinaciones")
            .update({ cajas: cajas as unknown as Record<string, unknown>[] }).eq("export_id", ship.export_id);
        }
        updated++;
      }
      setImportMsg(updated > 0 ? `✓ ${updated} boxes updated` : "No matching shipments found");
      if (updated > 0) fetchAll();
    } catch (err) { setImportMsg(String(err)); }
    e.target.value = "";
  }

  function downloadTemplate() {
    const csv = "hawb,caja,tipo,variedad,cantidad,stem_length,color\nHAWB123,1,bouquet,Freedom,12,60cm,Red\nHAWB123,2,bonche,Vendela,25,50cm,White\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "shipment_template.csv"; a.click();
  }

  // ── Bulk edit functions ──
  function toggleBulkSelect(shipId: string, boxIdx: number) {
    const key = `${shipId}|${boxIdx}`;
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAllBoxes(allCajas: { ship: Exportacion; boxIdx: number }[]) {
    const keys = allCajas.map(c => `${c.ship.id}|${c.boxIdx}`);
    const allSelected = keys.every(k => bulkSelected.has(k));
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (allSelected) { keys.forEach(k => next.delete(k)); }
      else { keys.forEach(k => next.add(k)); }
      return next;
    });
  }

  function startBulkEdit() {
    if (bulkSelected.size === 0) return;
    setBulkDetails([{ tipo: "bouquet", variedad: "", cantidad: 25, stem_length: "", color: "" }]);
    setBulkMode(true);
  }

  function addBulkDetail() {
    setBulkDetails(prev => [...prev, { tipo: "bouquet", variedad: "", cantidad: 1, stem_length: "", color: "" }]);
  }

  function updateBulkDetail(idx: number, field: keyof BoxDetail, value: string | number) {
    setBulkDetails(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  }

  function removeBulkDetail(idx: number) {
    setBulkDetails(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveBulkEdit() {
    if (bulkSelected.size === 0 || bulkDetails.length === 0) return;
    setBulkSaving(true);

    // Group selected boxes by shipment
    const shipBoxMap = new Map<string, number[]>();
    for (const key of bulkSelected) {
      const [shipId, boxIdxStr] = key.split("|");
      if (!shipBoxMap.has(shipId)) shipBoxMap.set(shipId, []);
      shipBoxMap.get(shipId)!.push(parseInt(boxIdxStr));
    }

    for (const [shipId, boxIdxes] of shipBoxMap) {
      const ship = shipments.find(s => s.id === shipId);
      if (!ship) continue;
      const cajas = parseCajas(ship.cajas);
      for (const boxIdx of boxIdxes) {
        if (cajas[boxIdx]) {
          (cajas[boxIdx] as CajaItem & { productos?: BoxDetail[] }).productos = [...bulkDetails];
        }
      }
      await supabase.from("exportaciones")
        .update({ cajas: cajas as unknown as Record<string, unknown>[] })
        .eq("id", ship.id);
      if (ship.export_id) {
        await supabase.from("coordinaciones")
          .update({ cajas: cajas as unknown as Record<string, unknown>[] })
          .eq("export_id", ship.export_id);
      }
      setShipments(prev => prev.map(s => s.id === ship.id ? { ...s, cajas } : s));
    }

    setBulkSaving(false);
    setBulkMode(false);
    setBulkSelected(new Set());
    setBulkDetails([]);
  }

  function cancelBulkEdit() {
    setBulkMode(false);
    setBulkSelected(new Set());
    setBulkDetails([]);
  }

  function downloadShipmentCSV(clienteName: string, dg: DateGroup) {
    const allBoxes = dg.shipments.flatMap(s => parseCajas(s.cajas).map((c, ci) => ({ ship: s, box: c, boxIdx: ci })));
    allBoxes.sort((a, b) => Number(a.box.caja) - Number(b.box.caja));
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows: string[] = ["hawb,awb,box,tipo,variedad,cantidad,stem_length,color"];
    for (const { box } of allBoxes) {
      const prods = Array.isArray(box.productos) ? (box.productos as BoxDetail[]) : [];
      if (prods.length > 0) {
        for (const p of prods) {
          rows.push([dg.hawb, dg.awb, box.caja, p.tipo, p.variedad, p.cantidad, p.stem_length, p.color].map(esc).join(","));
        }
      } else {
        rows.push([dg.hawb, dg.awb, box.caja, "", box.titulo || "", "", box.stem_length || "", ""].map(esc).join(","));
      }
    }
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${clienteName.replace(/\s+/g, "_")}_${dg.hawb || "shipment"}_${dg.fecha || "nodate"}.csv`;
    a.click();
  }

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-cyan-400" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-sm text-dim">{shipments.length} total records · {groups.length} clients</span>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg text-xs transition-all">
              <Download size={14} /> Template CSV
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs transition-all cursor-pointer">
              <Upload size={14} /> Import CSV/JSON
              <input type="file" accept=".csv,.json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>
        {importMsg && (
          <p className={`text-xs mt-2 ${importMsg.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{importMsg}</p>
        )}
      </Card>

      {/* Hierarchical list */}
      <div className="space-y-2">
        {groups.map(cg => {
          const isClientOpen = expandedClient === cg.clienteId;
          const totalBoxes = cg.dates.reduce((s, d) => s + d.shipments.reduce((ss, sh) => ss + parseCajas(sh.cajas).length, 0), 0);

          return (
            <Card key={cg.clienteId} className="overflow-hidden">
              {/* ── Level 1: Client ── */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => toggleClient(cg.clienteId)}
              >
                {isClientOpen ? <ChevronDown size={16} className="text-cyan-400" /> : <ChevronRight size={16} className="text-dim" />}
                <span className="text-sm font-semibold text-white flex-1">{cg.clienteName}</span>
                <span className="text-xs text-dim">{cg.dates.length} shipment{cg.dates.length !== 1 ? "s" : ""}</span>
                <span className="text-xs text-purple-400">{totalBoxes} box{totalBoxes !== 1 ? "es" : ""}</span>
              </div>

              {isClientOpen && (
                <div className="border-t border-white/5">
                  {cg.dates.map((dg, di) => {
                    const dateKey = `${cg.clienteId}|${di}`;
                    const isDateOpen = expandedDate === dateKey;
                    const allCajas = dg.shipments.flatMap(s => parseCajas(s.cajas).map((c, ci) => ({ ship: s, box: c, boxIdx: ci })));
                    allCajas.sort((a, b) => Number(a.box.caja) - Number(b.box.caja));

                    return (
                      <div key={di}>
                        {/* ── Level 2: Date + HAWB/AWB ── */}
                        <div
                          className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 cursor-pointer hover:bg-white/3 transition-colors border-t border-white/5"
                          onClick={() => toggleDate(dateKey)}
                        >
                          {isDateOpen ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-dim" />}
                          <span className="text-xs font-mono text-cyan-400">{dg.fecha || "No date"}</span>
                          <span className="text-xs text-dim">HAWB: {dg.hawb || "—"}</span>
                          <span className="text-xs text-dim hidden sm:inline">AWB: {dg.awb || "—"}</span>
                          <button onClick={(e) => { e.stopPropagation(); downloadShipmentCSV(cg.clienteName, dg); }}
                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 border border-green-400/20 hover:border-green-400/40 px-2 py-1 rounded transition-all ml-1"
                            title="Download shipment as CSV">
                            <Download size={12} /> CSV
                          </button>
                          <span className="ml-auto text-xs text-purple-400">{allCajas.length} box{allCajas.length !== 1 ? "es" : ""}</span>
                        </div>

                        {isDateOpen && (
                          <div className="bg-bg/30 px-3 sm:px-6 py-2 space-y-2 border-t border-white/5">
                            {/* Bulk edit toolbar */}
                            <div className="flex flex-wrap items-center gap-2 py-1">
                              <button onClick={() => selectAllBoxes(allCajas)}
                                className="flex items-center gap-1 text-xs text-dim hover:text-white transition-colors">
                                {allCajas.every(c => bulkSelected.has(`${c.ship.id}|${c.boxIdx}`))
                                  ? <CheckSquare size={14} className="text-cyan-400" />
                                  : <Square size={14} />}
                                Select All
                              </button>
                              {bulkSelected.size > 0 && !bulkMode && (
                                <button onClick={startBulkEdit}
                                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-400/20 hover:border-purple-400/40 px-2 py-1 rounded transition-all">
                                  <Layers size={12} /> Bulk Edit ({bulkSelected.size})
                                </button>
                              )}
                              {bulkSelected.size > 0 && (
                                <button onClick={() => setBulkSelected(new Set())}
                                  className="text-xs text-dim hover:text-white transition-colors">Clear</button>
                              )}
                            </div>

                            {/* Bulk edit form */}
                            {bulkMode && bulkSelected.size > 0 && (
                              <div className="border border-purple-400/20 bg-purple-400/5 rounded-lg p-3 space-y-2 animate-fade-in">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-purple-400 font-semibold">Bulk Edit — {bulkSelected.size} boxes selected</p>
                                  <button onClick={cancelBulkEdit} className="text-dim hover:text-white"><X size={14} /></button>
                                </div>
                                <p className="text-xs text-dim">Products defined here will replace contents of all selected boxes.</p>
                                {bulkDetails.map((d, di) => (
                                  <div key={di} className="flex flex-wrap items-center gap-2">
                                    <select value={d.tipo} onChange={e => updateBulkDetail(di, "tipo", e.target.value)}
                                      className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-20 sm:w-24">
                                      <option value="bouquet">Bouquet</option>
                                      <option value="bonche">Bonche</option>
                                    </select>
                                    <div className="flex-1 min-w-[100px]">
                                      <VarietyPicker
                                        variedades={variedades}
                                        value={d.variedad}
                                        onChange={v => updateBulkDetail(di, "variedad", v)}
                                        onColorFill={c => updateBulkDetail(di, "color", c)}
                                      />
                                    </div>
                                    <input type="number" value={d.cantidad}
                                      onChange={e => updateBulkDetail(di, "cantidad", parseInt(e.target.value) || 0)}
                                      placeholder="Qty"
                                      className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-14" />
                                    <input value={d.stem_length}
                                      onChange={e => updateBulkDetail(di, "stem_length", e.target.value)}
                                      placeholder="SL"
                                      className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-14 sm:w-16" />
                                    <input value={d.color} onChange={e => updateBulkDetail(di, "color", e.target.value)} placeholder="Color"
                                      className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-purple-400 w-16 sm:w-20" />
                                    <button onClick={() => removeBulkDetail(di)} className="text-dim hover:text-red-400">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <button onClick={addBulkDetail}
                                    className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                                    <Plus size={12} /> Add product
                                  </button>
                                  <div className="flex gap-2 ml-auto">
                                    <button onClick={cancelBulkEdit}
                                      className="px-3 py-1.5 border border-white/10 rounded text-xs text-dim hover:text-white">Cancel</button>
                                    <button onClick={saveBulkEdit} disabled={bulkSaving || bulkDetails.length === 0}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded text-xs disabled:opacity-40">
                                      {bulkSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                      Apply to {bulkSelected.size} boxes
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {allCajas.map(({ ship, box, boxIdx }, bi) => {
                              const prods = Array.isArray(box.productos) ? (box.productos as BoxDetail[]) : [];
                              const isEditing = editingBox?.shipId === ship.id && editingBox?.boxIdx === boxIdx;

                              return (
                                <div key={bi} className={`border rounded-lg p-3 ${bulkSelected.has(`${ship.id}|${boxIdx}`) ? "border-purple-400/30 bg-purple-400/5" : "border-white/5"}`}>
                                  <div className="flex items-center gap-3">
                                    <button onClick={(e) => { e.stopPropagation(); toggleBulkSelect(ship.id, boxIdx); }}
                                      className="flex-shrink-0 text-dim hover:text-purple-400 transition-colors">
                                      {bulkSelected.has(`${ship.id}|${boxIdx}`)
                                        ? <CheckSquare size={16} className="text-purple-400" />
                                        : <Square size={16} />}
                                    </button>
                                    <span className="text-xs font-mono text-cyan-400 font-bold">Box {box.caja}</span>
                                    <span className="text-xs text-white flex-1 truncate">{box.titulo || "—"}</span>
                                    {box.stem_length && <span className="text-xs text-dim">SL: {box.stem_length}</span>}
                                    <button onClick={() => isEditing ? setEditingBox(null) : startEditBox(ship, boxIdx)}
                                      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors">
                                      {isEditing ? <X size={12} /> : <Pencil size={12} />}
                                      {isEditing ? "Cancel" : "Edit"}
                                    </button>
                                  </div>

                                  {/* Show existing details */}
                                  {!isEditing && prods.length > 0 && (
                                    <div className="mt-2 space-y-1 ml-4">
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
                                  {!isEditing && prods.length === 0 && (
                                    <p className="text-xs text-dim mt-1 ml-4 italic">No details — click Edit</p>
                                  )}

                                  {/* Edit form */}
                                  {isEditing && (
                                    <div className="mt-3 space-y-2 animate-fade-in">
                                      {boxDetails.map((d, di) => (
                                        <div key={di} className="flex flex-wrap items-center gap-2">
                                          <select value={d.tipo} onChange={e => updateDetail(di, "tipo", e.target.value)}
                                            className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-20 sm:w-24">
                                            <option value="bouquet">Bouquet</option>
                                            <option value="bonche">Bonche</option>
                                          </select>
                                          <div className="flex-1 min-w-[100px]">
                                            <VarietyPicker
                                              variedades={variedades}
                                              value={d.variedad}
                                              onChange={v => updateDetail(di, "variedad", v)}
                                              onColorFill={c => updateDetail(di, "color", c)}
                                            />
                                          </div>
                                          <input type="number" value={d.cantidad}
                                            onChange={e => updateDetail(di, "cantidad", parseInt(e.target.value) || 0)}
                                            placeholder="Qty"
                                            className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-14" />
                                          <input value={d.stem_length}
                                            onChange={e => updateDetail(di, "stem_length", e.target.value)}
                                            placeholder="SL"
                                            className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-white w-14 sm:w-16" />
                                          <input value={d.color}
                                            onChange={e => updateDetail(di, "color", e.target.value)}
                                            placeholder="Color"
                                            className="bg-panel border border-white/10 rounded px-2 py-1.5 text-xs text-purple-400 w-16 sm:w-20" />
                                          <button onClick={() => removeDetail(di)} className="text-dim hover:text-red-400">
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex gap-2 mt-2">
                                        <button onClick={addDetail}
                                          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                                          <Plus size={12} /> Add product
                                        </button>
                                        <button onClick={saveDetails} disabled={saving}
                                          className="flex items-center gap-1 ml-auto px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded text-xs disabled:opacity-40">
                                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                          Save
                                        </button>
                                      </div>
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
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
