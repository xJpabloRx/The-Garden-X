"use client";
import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import type { Variedad } from "@/lib/types";
import { Plus, Trash2, Upload, Download, Loader2 } from "lucide-react";

export default function VarietiesAdmin({ variedades: initial }: { variedades: Variedad[] }) {
  const [variedades, setVariedades] = useState(initial);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !color.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("variedades")
      .insert({ nombre: nombre.trim(), color: color.trim() }).select().single();
    if (data) setVariedades(prev => [...prev, data as Variedad]);
    setNombre(""); setColor(""); setSaving(false);
  }

  async function toggle(v: Variedad) {
    await supabase.from("variedades").update({ activo: !v.activo }).eq("id", v.id);
    setVariedades(prev => prev.map(x => x.id === v.id ? { ...x, activo: !x.activo } : x));
  }

  async function remove(id: string) {
    await supabase.from("variedades").delete().eq("id", id);
    setVariedades(prev => prev.filter(v => v.id !== id));
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { setUploadMsg("CSV must have a header + at least 1 row"); setUploading(false); return; }

    const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/^"+|"+$/g, ""));
    const nameIdx = header.indexOf("nombre");
    const colorIdx = header.indexOf("color");
    if (nameIdx === -1) { setUploadMsg("CSV must have a 'nombre' column"); setUploading(false); return; }

    const strip = (s: string) => s.replace(/^"+|"+$/g, "").trim();
    const rows: { nombre: string; color: string }[] = [];
    const existingNames = new Set(variedades.map(v => strip(v.nombre).toLowerCase()));

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => strip(c));
      const n = cols[nameIdx];
      const c = colorIdx >= 0 ? (cols[colorIdx] || "") : "";
      if (!n) continue;
      if (existingNames.has(n.toLowerCase())) continue;
      existingNames.add(n.toLowerCase());
      rows.push({ nombre: n, color: c });
    }

    if (rows.length === 0) { setUploadMsg("No new varieties to import (all duplicates or empty)"); setUploading(false); return; }

    const { data, error } = await supabase.from("variedades")
      .insert(rows).select();
    if (error) { setUploadMsg(`Error: ${error.message}`); setUploading(false); return; }
    if (data) setVariedades(prev => [...prev, ...(data as Variedad[])]);
    setUploadMsg(`Imported ${rows.length} varieties`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card>
      <CardHeader><CardTitle>Varieties ({variedades.length})</CardTitle></CardHeader>

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Variety name..."
          className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
        <input value={color} onChange={e => setColor(e.target.value)}
          placeholder="Color (Red, White, Pink...)"
          className="sm:w-44 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
        <button type="submit" disabled={saving || !nombre.trim() || !color.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-sm disabled:opacity-40 transition-all">
          <Plus size={14} /> Add
        </button>
      </form>

      {/* CSV Upload */}
      <div className="flex flex-wrap items-center gap-3 mb-6 pb-4 border-b border-white/5">
        <button onClick={() => {
            const rows = ["nombre,color"];
            for (const v of variedades) {
              const n = v.nombre.replace(/^"+|"+$/g, "").replace(/,/g, " ");
              const c = (v.color || "").replace(/^"+|"+$/g, "").replace(/,/g, " ");
              rows.push(`${n},${c}`);
            }
            const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "varieties.csv"; a.click();
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-purple-400 border border-purple-400/20 hover:border-purple-400/40 rounded-lg transition-all">
          <Download size={12} /> Download CSV
        </button>
        <label className={`flex items-center gap-2 px-3 py-1.5 text-xs text-cyan-400 border border-cyan-400/20 hover:border-cyan-400/40 rounded-lg transition-all cursor-pointer ${uploading ? "opacity-40 pointer-events-none" : ""}`}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Import CSV
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
        </label>
        {uploadMsg && <span className={`text-xs ${uploadMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>{uploadMsg}</span>}
      </div>

      <div className="space-y-2">
        {variedades.map(v => (
          <div key={v.id} className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 bg-bg rounded-lg border border-white/5">
            <span className="flex-1 text-sm text-white">{v.nombre}</span>
            <span className="text-xs text-dim px-2 py-0.5 rounded border border-white/10 bg-white/5">
              {v.color || "—"}
            </span>
            <button onClick={() => toggle(v)}
              className={`text-xs px-2 py-0.5 rounded border transition-all ${
                v.activo
                  ? "text-green-400 border-green-400/20 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/20"
                  : "text-dim border-white/10 hover:text-green-400 hover:border-green-400/20"
              }`}>
              {v.activo ? "Active" : "Inactive"}
            </button>
            <button onClick={() => remove(v.id)} className="text-dim hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
