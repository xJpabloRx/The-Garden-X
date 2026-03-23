"use client";
import { useState, useRef, useEffect } from "react";
import { decodeQRToken, isValidQRToken, isShortToken } from "@/lib/qr";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Camera, Upload, X, CheckCircle, ShieldAlert, ChevronDown, ChevronRight } from "lucide-react";

type QRData = Record<string, unknown>;

/* ── Collapsible section ── */
function Collapsible({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-dim uppercase tracking-wider hover:bg-white/2 transition-colors">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/* ── QR Result display ── */
function QRResult({ result }: { result: QRData }) {
  const caja = result.caja != null && typeof result.caja === "object" ? result.caja as Record<string, unknown> : null;
  // Products from inside the caja (cajas jsonb has tipo/variedad/cantidad/stem_length/color per product)
  const cajaProducts: Record<string, unknown>[] = caja && Array.isArray(caja.productos) ? caja.productos as Record<string, unknown>[] : [];
  // Fallback: if caja itself IS a product entry (has tipo+variedad), treat it as a single-product list
  const products: Record<string, unknown>[] = cajaProducts.length > 0
    ? cajaProducts
    : (caja && caja.tipo && caja.variedad) ? [caja]
    : (Array.isArray(result.productos) ? result.productos as Record<string, unknown>[] : []);

  return (
    <div className="space-y-3 animate-fade-in text-sm">
      {/* ── Box Contents ── */}
      {(caja || products.length > 0) && (
        <div className="bg-gradient-to-b from-cyan-500/5 to-transparent border border-cyan-500/20 rounded-xl overflow-hidden">
          {/* Box header */}
          {caja && (
            <div className="px-4 pt-4 pb-3 border-b border-white/5">
              <div className="flex items-baseline gap-3">
                <span className="text-cyan-400 font-mono font-bold text-base">Box {String(caja.caja ?? "1")}</span>
                {caja.titulo ? <span className="text-white font-semibold">{String(caja.titulo)}</span> : null}
              </div>
              {caja.composicion ? <p className="text-xs text-dim mt-1 font-mono">{String(caja.composicion)}</p> : null}
            </div>
          )}

          {/* Product lines — same style as ShipmentsAdmin */}
          {products.length > 0 && (
            <div className="divide-y divide-white/5">
              {products.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-white capitalize">{String(p.tipo || p.bunch || "bonche")}</span>
                  <span className="text-cyan-400 font-medium">{String(p.variedad || p.nombre || "—")}</span>
                  <span className="text-dim">×{String(p.cantidad)}</span>
                  {p.stem_length ? <span className="text-dim">SL: {String(p.stem_length)}</span> : null}
                  {p.color ? <span className="text-purple-400">{String(p.color)}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Order Details (collapsible, closed) ── */}
      <Collapsible title="Order Details">
        <div className="grid grid-cols-2 gap-2">
          {([
            ["Client", result.cliente], ["Date", result.fecha],
            ["HAWB", result.hawb], ["AWB", result.awb],
            ["Origin", result.origen], ["Destination", result.destino],
            ["DAE", result.dae], ["HBs", result.hbs],
          ] as [string, unknown][]).map(([k, v]) => (
            <div key={k} className="bg-bg rounded-lg px-3 py-2">
              <p className="text-xs text-dim">{k}</p>
              <p className="text-white font-mono text-xs mt-0.5">{String(v ?? "—")}</p>
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

export default function QRScanner({ clienteId }: { clienteId: string }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult]     = useState<QRData | null>(null);
  const [error, setError]       = useState("");
  const [token, setToken]       = useState("");
  const [checking, setChecking] = useState(false);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const supabase  = createClient();

  useEffect(() => {
    return () => { stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Look up a short/UUID token in exportaciones */
  async function lookupToken(qrToken: string): Promise<QRData | null> {
    const { data } = await supabase
      .from("exportaciones")
      .select("*")
      .eq("qr_token", qrToken.trim())
      .single();
    return data as QRData | null;
  }

  /** Verify ownership: check cliente_id on exportaciones, coordinaciones, inventario */
  async function verifyOwnership(qrToken: string): Promise<boolean> {
    // 1. Check exportaciones.cliente_id (new system)
    const { data: exp } = await supabase
      .from("exportaciones")
      .select("id, cliente_id")
      .eq("qr_token", qrToken)
      .single();
    if (exp?.cliente_id === clienteId) return true;

    // 2. Check coordinaciones
    const { data: coord } = await supabase
      .from("coordinaciones")
      .select("id, cliente_id")
      .eq("qr_token", qrToken)
      .single();
    if (coord?.cliente_id === clienteId) return true;

    // 3. Check inventario
    const { data: inv } = await supabase
      .from("inventario")
      .select("id, cliente_id")
      .eq("qr_token", qrToken)
      .single();
    if (inv?.cliente_id === clienteId) return true;

    return false;
  }

  async function processToken(raw: string) {
    const trimmed = raw.trim();
    if (!isValidQRToken(trimmed)) {
      setError("QR not recognized or invalid");
      return;
    }

    setChecking(true);
    let data: QRData | null = null;

    if (isShortToken(trimmed)) {
      // Short token or UUID → lookup in Supabase exportaciones
      data = await lookupToken(trimmed);
      if (!data) {
        setChecking(false);
        setError("QR token not found in database");
        return;
      }
      const owned = await verifyOwnership(trimmed);
      setChecking(false);
      if (!owned) {
        setError("Access denied — this QR does not belong to your account.");
        setResult(null);
        return;
      }
      // Parse JSON strings
      if (typeof data.cajas === "string") {
        try { data.cajas = JSON.parse(data.cajas as string); } catch { /* keep */ }
      }
      if (typeof data.productos === "string") {
        try { data.productos = JSON.parse(data.productos as string); } catch { /* keep */ }
      }
      const cajasArr = data.cajas as Record<string, unknown>[] | undefined;
      if (Array.isArray(cajasArr) && cajasArr.length > 0) {
        data.caja = cajasArr[0];
      }
    } else {
      // Legacy XOR-encrypted token
      const decoded = decodeQRToken(trimmed);
      if (!decoded) { setChecking(false); setError("Could not decode QR"); return; }
      data = { ...decoded, token: trimmed };
      const owned = await verifyOwnership(trimmed);
      setChecking(false);
      if (!owned) {
        setError("Access denied — this QR does not belong to your account.");
        setResult(null);
        return;
      }
    }

    setResult(data);
    setError("");
  }

  async function startCamera() {
    setError(""); setResult(null);
    try {
      // Request camera with autofocus and high resolution for better QR detection
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // Use continuous decoding — much more reliable than decodeOnce
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      const controls = await reader.decodeFromStream(stream, videoRef.current!, (res, err) => {
        if (res) {
          const text = res.getText();
          if (text) {
            stopCamera();
            processToken(text);
          }
        }
        // Ignore NotFoundException — it just means no QR found in this frame
        if (err && err.name !== "NotFoundException") {
          // Only log unexpected errors, don't show to user during scanning
        }
      });
      controlsRef.current = controls;
    } catch (e: unknown) {
      stopCamera();
      setError(e instanceof Error ? e.message : "Camera access error");
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setResult(null);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      // Create an image element and decode from it — works better than canvas for photos
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
      });

      // Try multiple approaches for reliability
      let decoded = false;

      // Approach 1: decode from image element directly
      try {
        const res = await reader.decodeFromImageElement(img);
        if (res) { processToken(res.getText()); decoded = true; }
      } catch { /* try next approach */ }

      // Approach 2: draw to canvas at different scales
      if (!decoded) {
        const scales = [1, 0.5, 2];
        for (const scale of scales) {
          if (decoded) break;
          try {
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.naturalWidth * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            const ctx = canvas.getContext("2d")!;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const res = await reader.decodeFromCanvas(canvas);
            if (res) { processToken(res.getText()); decoded = true; }
          } catch { /* try next scale */ }
        }
      }

      URL.revokeObjectURL(url);
      if (!decoded) setError("No QR code found in image. Try a clearer photo.");
    } catch {
      setError("No QR code found in image");
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Scan QR</CardTitle></CardHeader>
        <div className="space-y-4">
          <div className="relative bg-bg rounded-xl overflow-hidden aspect-square max-w-xs mx-auto border border-white/10">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera size={48} className="text-dim" />
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-cyan-400 rounded-lg opacity-70 animate-pulse">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
                </div>
                <p className="absolute bottom-3 text-xs text-cyan-400 bg-black/60 px-3 py-1 rounded-full">Scanning...</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {!scanning ? (
              <button onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 py-2.5 rounded-lg text-sm transition-all">
                <Camera size={16} /> Open Camera
              </button>
            ) : (
              <button onClick={stopCamera}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-lg text-sm transition-all">
                <X size={16} /> Stop
              </button>
            )}
            <label className="flex-1 flex items-center justify-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-2.5 rounded-lg text-sm transition-all cursor-pointer">
              <Upload size={16} /> Upload Image
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </label>
          </div>
          <div>
            <label className="block text-xs text-dim mb-1.5">Or paste token directly</label>
            <div className="flex gap-2">
              <input value={token} onChange={e => setToken(e.target.value)}
                placeholder="Token..."
                className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent" />
              <button onClick={() => processToken(token)}
                className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-lg text-xs transition-all">
                Decode
              </button>
            </div>
          </div>
          {checking && (
            <p className="text-xs text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg px-3 py-2">
              Verifying ownership...
            </p>
          )}
          {error && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Box Contents</CardTitle>
          {result && <CheckCircle size={18} className="text-green-400" />}
        </CardHeader>
        {!result ? (
          <div className="flex items-center justify-center h-48 text-dim text-sm">
            Scan a QR code to view contents
          </div>
        ) : (
          <QRResult result={result} />
        )}
      </Card>
    </div>
  );
}
