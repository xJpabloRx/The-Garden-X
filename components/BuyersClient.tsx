"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Search, Plus, Loader2, X, Pencil, Trash2, UserCircle } from "lucide-react";

type Buyer = {
  id: string; cliente_id: string; nombre: string;
  direccion?: string; telefono?: string; email?: string; notas?: string; created_at: string;
};

export default function BuyersClient({ initialBuyers, clienteId }: {
  initialBuyers: Record<string, unknown>[]; clienteId: string;
}) {
  const supabase = createClient();
  const [buyers, setBuyers] = useState<Buyer[]>(
    initialBuyers.map(r => ({
      id: String(r.id), cliente_id: String(r.cliente_id), nombre: String(r.nombre ?? ""),
      direccion: r.direccion ? String(r.direccion) : undefined,
      telefono: r.telefono ? String(r.telefono) : undefined,
      email: r.email ? String(r.email) : undefined,
      notas: r.notas ? String(r.notas) : undefined,
      created_at: String(r.created_at ?? ""),
    }))
  );
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function resetForm() {
    setShowForm(false); setEditing(null); setNombre(""); setDireccion("");
    setTelefono(""); setEmail(""); setNotas(""); setError("");
  }

  function startEdit(b: Buyer) {
    setEditing(b); setNombre(b.nombre); setDireccion(b.direccion || "");
    setTelefono(b.telefono || ""); setEmail(b.email || ""); setNotas(b.notas || "");
    setShowForm(true);
  }

  async function handleSave() {
    if (!nombre.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const payload = {
      cliente_id: clienteId, nombre: nombre.trim(),
      direccion: direccion.trim() || null, telefono: telefono.trim() || null,
      email: email.trim() || null, notas: notas.trim() || null,
    };
    if (editing) {
      const { error: err } = await supabase.from("compradores").update(payload).eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
      setBuyers(prev => prev.map(b => b.id === editing.id ? { ...b, ...payload, direccion: payload.direccion ?? undefined, telefono: payload.telefono ?? undefined, email: payload.email ?? undefined, notas: payload.notas ?? undefined } : b));
    } else {
      const { data, error: err } = await supabase.from("compradores").insert(payload).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      if (data) setBuyers(prev => [...prev, { id: data.id, cliente_id: clienteId, nombre: payload.nombre, direccion: payload.direccion ?? undefined, telefono: payload.telefono ?? undefined, email: payload.email ?? undefined, notas: payload.notas ?? undefined, created_at: data.created_at }]);
    }
    resetForm(); setSaving(false);
  }

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    setBuyers(prev => prev.filter(b => b.id !== id));
    await supabase.from("compradores").delete().eq("id", id);
    setConfirmDelete(null); setDeleting(null);
  }

  const filtered = search
    ? buyers.filter(b => b.nombre.toLowerCase().includes(search.toLowerCase()) || (b.email || "").toLowerCase().includes(search.toLowerCase()) || (b.telefono || "").includes(search))
    : buyers;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2 bg-bg border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-accent" />
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold rounded-lg text-sm">
          <Plus size={14} /> New Client
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-panel border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editing ? "Edit Client" : "New Client"}</h3>
              <button onClick={resetForm} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="block text-xs text-dim mb-1">Name *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Client name..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Address</label>
              <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Optional..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-dim mb-1">Phone</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Optional..."
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs text-dim mb-1">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional..."
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-dim mb-1">Notes</label>
              <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Optional..."
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {editing ? "Save Changes" : "Create Client"}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Clients ({filtered.length})</CardTitle>
        </CardHeader>
        {filtered.length === 0 && <p className="text-dim text-sm text-center py-8">No clients yet — create one to get started</p>}
        {filtered.length > 0 && (
          <div className="space-y-1 px-1 pb-2">
            {filtered.map(b => (
              <div key={b.id} className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border border-white/5 rounded-lg hover:bg-white/2 transition-colors">
                <UserCircle size={20} className="text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{b.nombre}</p>
                  <div className="flex gap-3 text-xs text-dim">
                    {b.telefono && <span>{b.telefono}</span>}
                    {b.email && <span>{b.email}</span>}
                    {b.direccion && <span className="truncate">{b.direccion}</span>}
                  </div>
                  {b.notas && <p className="text-xs text-dim/60 mt-0.5 truncate">{b.notas}</p>}
                </div>
                <button onClick={() => startEdit(b)} className="text-dim hover:text-cyan-400 transition-colors p-1"><Pencil size={14} /></button>
                {confirmDelete === b.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-yellow-400">Sure?</span>
                    <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                      className="text-xs text-red-400 border border-red-400/20 px-2 py-0.5 rounded disabled:opacity-40">
                      {deleting === b.id ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="text-xs text-dim border border-white/10 px-2 py-0.5 rounded">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(b.id)} className="text-dim hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
