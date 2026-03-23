"use client";
import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Orden, OrdenItem } from "@/lib/types";
import {
  ChevronDown, ChevronRight, Search, Filter,
  Check, X, Loader2, Trash2, Package, AlertTriangle,
  Clock, CheckCircle, Truck, XCircle,
} from "lucide-react";

type OrdenWithClient = Orden & { _clientName: string };

const ESTADOS = ["pendiente", "confirmada", "procesando", "completada", "cancelada"] as const;
type Estado = typeof ESTADOS[number];

const ESTADO_CONFIG: Record<Estado, { icon: typeof Clock; color: string; label: string }> = {
  pendiente:   { icon: Clock,       color: "text-amber-400",  label: "Pending" },
  confirmada:  { icon: Check,       color: "text-cyan-400",   label: "Confirmed" },
  procesando:  { icon: Loader2,     color: "text-purple-400", label: "Processing" },
  completada:  { icon: CheckCircle, color: "text-green-400",  label: "Completed" },
  cancelada:   { icon: XCircle,     color: "text-red-400",    label: "Cancelled" },
};

export default function OrdersAdmin({ ordenes: initial, clientMap }: {
  ordenes: Orden[]; clientMap: Record<string, string>;
}) {
  const supabase = createClient();
  const [ordenes, setOrdenes] = useState<OrdenWithClient[]>(
    initial.map(o => ({ ...o, _clientName: clientMap[o.cliente_id] || "Unknown" }))
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<Estado | "all">("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editNotes, setEditNotes] = useState<{ id: string; notas: string } | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const filtered = useMemo(() => {
    let list = ordenes;
    if (filterEstado !== "all") list = list.filter(o => o.estado === filterEstado);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o._clientName.toLowerCase().includes(q) ||
        o.fecha_salida_finca.includes(q) ||
        o.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [ordenes, filterEstado, search]);

  // Stats
  const stats = useMemo(() => {
    const total = ordenes.length;
    const pendiente = ordenes.filter(o => o.estado === "pendiente").length;
    const confirmada = ordenes.filter(o => o.estado === "confirmada").length;
    const totalBoxes = ordenes.reduce((s, o) =>
      s + (o.orden_items?.reduce((ss, it) => ss + it.cantidad_cajas, 0) ?? 0), 0);
    return { total, pendiente, confirmada, totalBoxes };
  }, [ordenes]);

  async function updateEstado(id: string, estado: Estado) {
    setUpdating(id);
    const { error } = await supabase.from("ordenes").update({ estado }).eq("id", id);
    if (!error) {
      setOrdenes(prev => prev.map(o => o.id === id ? { ...o, estado } : o));
    }
    setUpdating(null);
  }

  async function deleteOrder(id: string) {
    setDeleting(true);
    // Delete items first, then order
    await supabase.from("orden_items").delete().eq("orden_id", id);
    const { error } = await supabase.from("ordenes").delete().eq("id", id);
    if (!error) {
      setOrdenes(prev => prev.filter(o => o.id !== id));
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }

  async function saveNotes() {
    if (!editNotes) return;
    setSavingNotes(true);
    const { error } = await supabase.from("ordenes").update({ notas: editNotes.notas || null }).eq("id", editNotes.id);
    if (!error) {
      setOrdenes(prev => prev.map(o => o.id === editNotes.id ? { ...o, notas: editNotes.notas || undefined } : o));
    }
    setSavingNotes(false);
    setEditNotes(null);
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total Orders", value: stats.total, color: "text-white" },
          { label: "Pending", value: stats.pendiente, color: "text-amber-400" },
          { label: "Confirmed", value: stats.confirmada, color: "text-cyan-400" },
          { label: "Total Boxes", value: stats.totalBoxes, color: "text-purple-400" },
        ].map(s => (
          <Card key={s.label} className="text-center p-3">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-dim text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 p-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search client, date, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-bg border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-dim" />
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as Estado | "all")}
              className="bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent">
              <option value="all">All Status</option>
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Orders list */}
      <Card>
        <CardHeader><CardTitle>Orders ({filtered.length})</CardTitle></CardHeader>
        {filtered.length === 0 && (
          <p className="text-dim text-sm text-center py-8">No orders found</p>
        )}
        <div className="space-y-1">
          {filtered.map(orden => {
            const isOpen = expanded === orden.id;
            const items = orden.orden_items ?? [];
            const totalBoxes = items.reduce((s, it) => s + it.cantidad_cajas, 0);
            const totalStems = items.reduce((s, it) => s + it.cantidad_cajas * (it.stems_por_caja || (it.tipo_caja === "bouquet" ? 12 : 25)), 0);
            const cfg = ESTADO_CONFIG[orden.estado];

            return (
              <div key={orden.id} className="border border-white/5 rounded-lg overflow-hidden">
                {/* Header row */}
                <button type="button" onClick={() => setExpanded(isOpen ? null : orden.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors text-left">
                  {isOpen
                    ? <ChevronDown size={14} className="text-dim flex-shrink-0" />
                    : <ChevronRight size={14} className="text-dim flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-semibold truncate">{orden._clientName}</span>
                      <span className="text-xs text-dim">·</span>
                      <span className="text-xs text-cyan-400 font-mono">{formatDate(orden.fecha_salida_finca)}</span>
                      {totalBoxes > 0 && (
                        <span className="text-xs text-purple-400 font-mono">{totalBoxes} box{totalBoxes !== 1 ? "es" : ""}</span>
                      )}
                    </div>
                    <p className="text-xs text-dim mt-0.5">Created: {formatDate(orden.created_at)}</p>
                  </div>
                  <Badge estado={orden.estado} />
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-white/5 animate-fade-in">
                    {/* Status actions */}
                    <div className="px-4 py-3 bg-white/2 space-y-3">
                      <div>
                        <p className="text-xs text-dim uppercase tracking-wider mb-2">Change Status</p>
                        <div className="flex flex-wrap gap-2">
                          {ESTADOS.map(e => {
                            const c = ESTADO_CONFIG[e];
                            const Icon = c.icon;
                            const active = orden.estado === e;
                            return (
                              <button key={e} type="button"
                                disabled={updating === orden.id}
                                onClick={() => !active && updateEstado(orden.id, e)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                                  active
                                    ? `${c.color} border-current/30 bg-current/10`
                                    : "text-dim border-white/10 hover:border-white/20 hover:text-white"
                                }`}>
                                {updating === orden.id ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-dim">Boxes: <span className="text-purple-400 font-bold">{totalBoxes}</span></span>
                        <span className="text-dim">Stems: <span className="text-cyan-400 font-bold">{totalStems}</span></span>
                        <span className="text-dim">Items: <span className="text-white font-bold">{items.length}</span></span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-xs text-dim uppercase tracking-wider">Order Items</p>
                      {items.length === 0 && (
                        <p className="text-xs text-dim italic py-2">No items in this order</p>
                      )}
                      {items.map(item => (
                        <OrderItemRow key={item.id} item={item} />
                      ))}
                    </div>

                    {/* Notes */}
                    <div className="px-4 py-3 border-t border-white/5">
                      {editNotes?.id === orden.id ? (
                        <div className="space-y-2">
                          <label className="text-xs text-dim uppercase tracking-wider">Admin Notes</label>
                          <textarea value={editNotes.notas} onChange={e => setEditNotes({ ...editNotes, notas: e.target.value })}
                            rows={2} placeholder="Add notes..."
                            className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent resize-none" />
                          <div className="flex gap-2">
                            <button onClick={saveNotes} disabled={savingNotes}
                              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg text-xs transition-all hover:bg-cyan-500/20 disabled:opacity-40">
                              {savingNotes ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                            </button>
                            <button onClick={() => setEditNotes(null)}
                              className="px-3 py-1.5 text-dim border border-white/10 rounded-lg text-xs hover:text-white transition-all">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-dim uppercase tracking-wider mb-1">Notes</p>
                            <p className="text-xs text-white">{orden.notas || <span className="text-dim italic">No notes</span>}</p>
                          </div>
                          <button onClick={() => setEditNotes({ id: orden.id, notas: orden.notas || "" })}
                            className="text-xs text-dim hover:text-cyan-400 border border-white/10 hover:border-cyan-400/30 px-2 py-1 rounded transition-all flex-shrink-0">
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="px-4 py-3 border-t border-white/5">
                      {deleteConfirm === orden.id ? (
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
                          <span className="text-xs text-red-400">Delete this order and all its items?</span>
                          <button onClick={() => deleteOrder(orden.id)} disabled={deleting}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg text-xs hover:bg-red-500/20 disabled:opacity-40">
                            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Confirm
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-3 py-1.5 text-dim border border-white/10 rounded-lg text-xs hover:text-white">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(orden.id)}
                          className="flex items-center gap-1.5 text-xs text-dim hover:text-red-400 transition-colors">
                          <Trash2 size={12} /> Delete order
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function OrderItemRow({ item }: { item: OrdenItem }) {
  const stemsPerBox = item.stems_por_caja || (item.tipo_caja === "bouquet" ? 12 : 25);
  return (
    <div className="flex items-center gap-3 bg-panel/50 border border-white/5 rounded-lg px-3 py-2">
      <Package size={14} className="text-purple-400 flex-shrink-0" />
      <span className="text-xs text-white capitalize">{item.tipo_caja}</span>
      <span className="text-xs text-cyan-400">{item.categoria}</span>
      <span className="text-xs text-white font-medium">{item.variedad_nombre || "—"}</span>
      <span className="text-xs text-dim">×{item.cantidad_cajas}</span>
      <span className="text-xs text-dim">({stemsPerBox} stems/box)</span>
      {item.stem_length ? <span className="text-xs text-dim">SL: {item.stem_length}</span> : null}
      {item.notas ? <span className="text-xs text-dim italic ml-auto truncate max-w-[120px]">{item.notas}</span> : null}
    </div>
  );
}
