import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // cookies de sesión: SameSite=Lax y, en https, Secure
    { cookieOptions: { sameSite: "lax", secure: typeof window !== "undefined" && window.location.protocol === "https:" } }
  );
}
