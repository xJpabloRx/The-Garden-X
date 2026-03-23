"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Orden } from "@/lib/types";

export default function OrderList({ ordenes }: { ordenes: Orden[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (ordenes.length === 0) {
    return <p className="text-dim text-sm text-center py-6">No orders yet</p>;
  }

  return (
    <div className="space-y-2">
      {ordenes.map(orden => {
        const isOpen = expanded === orden.id;
        const items = orden.orden_items ?? [];
        const totalBoxes = items.reduce((s, it) => s + it.cantidad_cajas, 0);

        return (
          <div key={orden.id} className="border border-white/5 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setExpanded(isOpen ? null : orden.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors text-left">
              {isOpen ? <ChevronDown size={14} className="text-dim flex-shrink-0" /> : <ChevronRight size={14} className="text-dim flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-white font-semibold">Farm departure: {formatDate(orden.fecha_salida_finca)}</span>
                  {totalBoxes > 0 && <span className="text-xs text-cyan-400 font-mono">{totalBoxes} box{totalBoxes !== 1 ? "es" : ""}</span>}
                </div>
                <p className="text-xs text-dim mt-0.5">Created: {formatDate(orden.created_at)}</p>
              </div>
              <Badge estado={orden.estado} />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2 animate-fade-in">
                {orden.notas && <p className="text-xs text-dim italic">&quot;{orden.notas}&quot;</p>}
                {items.length === 0 && <p className="text-xs text-dim">No box details available</p>}
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3 text-xs text-dim">
                    <span className="text-white capitalize">{item.tipo_caja}</span>
                    <span className="text-cyan-400">{item.categoria}</span>
                    <span>{item.variedad_nombre ?? "—"}</span>
                    <span>×{item.cantidad_cajas}</span>
                    {item.stems_por_caja ? <span>({item.stems_por_caja} stems)</span> : null}
                    {item.stem_length ? <span>SL: {item.stem_length}</span> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
