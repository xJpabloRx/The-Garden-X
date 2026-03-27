"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { Cliente } from "@/lib/types";
import { Plus, UserCheck, UserX, Pencil, Trash2, X, Save, Loader2, KeyRound } from "lucide-react";

export default function ClientsAdmin({ clientes: initial }: { clientes: Cliente[] }) {
  const [clientes, setClientes] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: "", empresa: "", email: "", username: "", password: "" });
  const [editForm, setEditForm] = useState({ nombre: "", empresa: "", email: "", username: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [resetPw, setResetPw] = useState<{ id: string; userId: string; nombre: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const supabase = createClient();

  async function createCliente(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { nombre: form.nombre } },
    });
    if (authErr) { setError(authErr.message); setSaving(false); return; }
    const { data: newCliente, error: dbErr } = await supabase.from("clientes").insert({
      user_id: authData.user?.id,
      nombre: form.nombre,
      empresa: form.empresa || null,
      email: form.email,
      username: form.username.toLowerCase() || null,
    }).select().single();
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    setClientes(prev => [newCliente as Cliente, ...prev]);
    setShowCreate(false);
    setForm({ nombre: "", empresa: "", email: "", username: "", password: "" });
    setSaving(false);
  }

  async function toggleActivo(cliente: Cliente) {
    const { error } = await supabase.from("clientes").update({ activo: !cliente.activo }).eq("id", cliente.id);
    if (!error) setClientes(prev => prev.map(c => c.id === cliente.id ? { ...c, activo: !c.activo } : c));
  }

  function startEdit(c: Cliente) {
    setEditingId(c.id);
    setEditForm({ nombre: c.nombre, empresa: c.empresa || "", email: c.email, username: c.username || "" });
  }

  async function saveEdit(id: string) {
    setSaving(true); setError("");
    const { error: err } = await supabase.from("clientes").update({
      nombre: editForm.nombre,
      empresa: editForm.empresa || null,
      email: editForm.email,
      username: editForm.username.toLowerCase() || null,
    }).eq("id", id);
    if (err) { setError(err.message); setSaving(false); return; }
    setClientes(prev => prev.map(c => c.id === id ? {
      ...c, nombre: editForm.nombre, empresa: editForm.empresa || undefined,
      email: editForm.email, username: editForm.username.toLowerCase() || undefined,
    } : c));
    setEditingId(null);
    setSaving(false);
  }

  async function deleteCliente(c: Cliente) {
    if (!confirm(`Delete client "${c.nombre}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    if (!error) setClientes(prev => prev.filter(cl => cl.id !== c.id));
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPw || newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setResetting(true); setError("");
    const { error: err } = await supabase.rpc("admin_reset_password", {
      target_user_id: resetPw.userId,
      new_password: newPassword,
    });
    if (err) { setError(err.message); setResetting(false); return; }
    setResetPw(null); setNewPassword(""); setResetting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clients ({clientes.length})</CardTitle>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-lg transition-all">
          <Plus size={14} /> New Client
        </button>
      </CardHeader>

      {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showCreate && (
        <form onSubmit={createCliente} className="bg-bg border border-white/5 rounded-xl p-5 mb-4 space-y-3 animate-fade-in">
          <p className="text-sm font-semibold text-white">Create client account</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              { label: "Full Name *", key: "nombre", type: "text", ph: "Full name" },
              { label: "Company", key: "empresa", type: "text", ph: "Company (optional)" },
              { label: "Username *", key: "username", type: "text", ph: "username" },
              { label: "Email *", key: "email", type: "email", ph: "client@company.com" },
              { label: "Password *", key: "password", type: "password", ph: "Min. 6 characters" },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="block text-xs text-dim mb-1">{f.label}</label>
                <input type={f.type} placeholder={f.ph}
                  value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.label.includes("*")}
                  className="w-full bg-panel border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
              {saving ? "Creating..." : "Create Client"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
          </div>
        </form>
      )}

      {clientes.length === 0 && (
        <p className="text-dim text-sm text-center py-8">No clients found. Run the admin SQL migration first.</p>
      )}

      <div className="space-y-2">
        {clientes.map(c => (
          <div key={c.id} className="bg-bg rounded-lg border border-white/5 overflow-hidden">
            {editingId === c.id ? (
              /* ── Edit mode ── */
              <div className="p-4 space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-dim mb-1">Name</label>
                    <input value={editForm.nombre} onChange={e => setEditForm(p => ({ ...p, nombre: e.target.value }))}
                      className="w-full bg-panel border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs text-dim mb-1">Company</label>
                    <input value={editForm.empresa} onChange={e => setEditForm(p => ({ ...p, empresa: e.target.value }))}
                      className="w-full bg-panel border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs text-dim mb-1">Username</label>
                    <input value={editForm.username} onChange={e => setEditForm(p => ({ ...p, username: e.target.value }))}
                      className="w-full bg-panel border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-xs text-dim mb-1">Email</label>
                    <input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-panel border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(c.id)} disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-xs disabled:opacity-40">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-white/10 rounded-lg text-xs text-dim hover:text-white">
                    <X size={12} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View mode ── */
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{c.nombre}</p>
                  <p className="text-xs text-dim truncate">
                    {c.username && <span className="text-cyan-400 mr-2">@{c.username}</span>}
                    {c.email}
                    {c.empresa && ` · ${c.empresa}`}
                  </p>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full border whitespace-nowrap",
                  c.activo
                    ? "text-green-400 bg-green-400/10 border-green-400/20"
                    : "text-dim bg-white/5 border-white/10")}>
                  {c.activo ? "Active" : "Inactive"}
                </span>
                <button onClick={() => toggleActivo(c)} className="text-dim hover:text-white transition-colors" title={c.activo ? "Deactivate" : "Activate"}>
                  {c.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                </button>
                <button onClick={() => startEdit(c)} className="text-dim hover:text-purple-400 transition-colors" title="Edit">
                  <Pencil size={16} />
                </button>
                <button onClick={() => { setResetPw({ id: c.id, userId: c.user_id, nombre: c.nombre }); setNewPassword(""); setError(""); }}
                  className="text-dim hover:text-amber-400 transition-colors" title="Reset Password">
                  <KeyRound size={16} />
                </button>
                <button onClick={() => deleteCliente(c)} className="text-dim hover:text-red-400 transition-colors" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reset Password Modal */}
      {resetPw && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setResetPw(null)}>
          <form onSubmit={handleResetPassword} className="bg-panel border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Reset Password</h3>
              <button type="button" onClick={() => setResetPw(null)} className="text-dim hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-xs text-dim">Set a new password for <span className="text-white font-semibold">{resetPw.nombre}</span></p>
            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="block text-xs text-dim mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters" required minLength={6}
                className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={resetting || newPassword.length < 6}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-lg text-sm disabled:opacity-40">
                {resetting ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {resetting ? "Resetting..." : "Reset Password"}
              </button>
              <button type="button" onClick={() => setResetPw(null)}
                className="px-4 py-2.5 border border-white/10 rounded-lg text-sm text-dim hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
