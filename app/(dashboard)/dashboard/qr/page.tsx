import { createClient } from "@/lib/supabase/server";
import QRScanner from "@/components/QRScanner";

export default async function QRPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user!.id).single();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">QR Scanner</h1>
        <p className="text-dim text-sm mt-1">Scan a box QR code to verify its contents</p>
      </div>
      <QRScanner clienteId={cliente?.id ?? ""} />
    </div>
  );
}
