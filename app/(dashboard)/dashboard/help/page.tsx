import { createClient } from "@/lib/supabase/server";
import ManualViewer from "@/components/ManualViewer";

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: adminRow } = await supabase
    .from("admins").select("id").eq("user_id", user!.id).single();

  return <ManualViewer isAdmin={!!adminRow} />;
}
