import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ¿Es admin? Se comprueba SIEMPRE en el servidor contra la tabla `admins` (con la sesión del usuario).
 * Antes el middleware se fiaba de una cookie `x-user-role` que escribía el propio navegador: cualquiera podía
 * ponerse «admin» a mano y ver las pantallas de administración.
 */
export async function esAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("admins").select("id").eq("user_id", userId).maybeSingle();
  return !!data;
}
