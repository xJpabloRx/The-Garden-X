"use client";
import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { guardarCookie, leerCookie } from "@/lib/cookies";

/**
 * Aviso de cookies (una vez por navegador). Solo se usan cookies necesarias: la sesión segura (Supabase) y
 * preferencias como «la cámara del escáner ya está autorizada». Nada de publicidad ni seguimiento.
 */
export default function AvisoCookies() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(leerCookie("tgx_cookies") !== "1"); }, []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 bg-panel border border-white/10 rounded-xl p-4 shadow-2xl animate-fade-in">
      <div className="flex items-start gap-3">
        <Cookie size={18} className="text-cyan-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-dim leading-relaxed">
          <p className="text-white font-semibold text-sm mb-1">Cookies</p>
          We only use essential cookies: to keep your session secure and to remember your preferences (for example,
          that you already allowed the camera for the QR scanner). No ads or tracking.
        </div>
      </div>
      <button onClick={() => { guardarCookie("tgx_cookies", "1"); setVisible(false); }}
        className="mt-3 w-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 py-2 rounded-lg text-xs transition-all">
        Got it
      </button>
    </div>
  );
}
