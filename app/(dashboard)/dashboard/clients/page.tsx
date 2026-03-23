import { createClient } from "@/lib/supabase/server";
import BuyersClient from "@/components/BuyersClient";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <p className="text-dim text-center py-12">Please log in</p>;

  const { data: cliente } = await supabase
    .from("clientes").select("id").eq("user_id", user.id).single();
  const clienteId = cliente?.id ?? "";

  let compradores: Record<string, unknown>[] = [];
  if (clienteId) {
    const { data } = await supabase
      .from("compradores").select("*").eq("cliente_id", clienteId)
      .order("nombre", { ascending: true });
    if (data) compradores = data;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Clients</h1>
        <p className="text-dim text-sm mt-1">Manage your frequent buyers</p>
      </div>
      <BuyersClient initialBuyers={compradores} clienteId={clienteId} />
    </div>
  );
}
