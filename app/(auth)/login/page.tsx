"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router   = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    // Resolve username → email if needed
    let email = username.trim();
    if (!email.includes("@")) {
      // Look up email by username in clientes table
      const { data } = await supabase
        .from("clientes")
        .select("email")
        .eq("username", email.toLowerCase())
        .single();
      if (!data?.email) {
        setError("Username not found");
        setLoading(false);
        return;
      }
      email = data.email;
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
      setError("Invalid credentials. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <span className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            THE GARDEN X
          </span>
          <p className="text-dim text-sm font-mono tracking-widest uppercase mt-2">
            Client Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-panel border border-white/5 rounded-2xl p-8 glow-cyan">
          <h2 className="text-lg font-semibold text-white mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs text-dim mb-1.5 uppercase tracking-wider">
                Username or Email
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="w-full bg-bg border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-dim focus:outline-none focus:border-accent transition-colors"
                placeholder="username or email@company.com"
              />
            </div>

            <div>
              <label className="block text-xs text-dim mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-bg border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-dim focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 disabled:opacity-50 text-black font-bold py-2.5 rounded-lg transition-all text-sm mt-2"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-dim text-xs mt-6 font-mono">
          3L J4RD1N © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
