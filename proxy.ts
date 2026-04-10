import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path         = request.nextUrl.pathname;
  const isAuthRoute  = path.startsWith("/login");
  const isDashboard  = path.startsWith("/dashboard");
  const isAdminRoute = path.startsWith("/dashboard/admin");

  // Sin sesión → solo puede ver /login
  if (!user && isDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Con sesión en /login → redirigir al dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Con sesión en dashboard → verificar que esté en clientes o admins
  if (user && isDashboard) {
    const { data: adminRow } = await supabase
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const isAdmin = !!adminRow;

    if (!isAdmin) {
      const { data: clienteRow } = await supabase
        .from("clientes")
        .select("id, activo")
        .eq("user_id", user.id)
        .maybeSingle();

      const isCliente = clienteRow?.activo === true;

      // Ni admin ni cliente activo → cerrar sesión y redirigir
      if (!isCliente) {
        await supabase.auth.signOut();
        const url = new URL("/login", request.url);
        url.searchParams.set("error", "no_access");
        return NextResponse.redirect(url);
      }

      // Cliente intentando acceder a rutas de admin → redirigir al dashboard
      if (isAdminRoute) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
