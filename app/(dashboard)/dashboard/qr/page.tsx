import { createClient } from "@/lib/supabase/server";
import { esAdmin } from "@/lib/rol";
import QRScanner from "@/components/QRScanner";

export default async function QRPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cliente } = await supabase
    .from("clientes").select("id, empresa, nombre").eq("user_id", user!.id).single();
  // Los admins pueden escanear cualquier caja (de cualquier cliente); se comprueba aquí, en el servidor.
  const admin = await esAdmin(supabase, user!.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">QR Scanner</h1>
        <p className="text-dim text-sm mt-1">
          {admin ? "Admin: scan any box QR code to see its contents and client" : "Scan a box QR code to verify its contents"}
        </p>
      </div>
      <QRScanner clienteId={cliente?.id ?? ""} empresa={cliente?.empresa ?? ""} nombre={cliente?.nombre ?? ""}
        esAdmin={admin} />
    </div>
  );
}
