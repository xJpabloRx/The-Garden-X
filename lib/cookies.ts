/**
 * Cookies de preferencias del navegador (no de sesión: la sesión la gestiona Supabase con sus propias cookies).
 * Siempre SameSite=Lax y, en https, Secure. Duran un año.
 *  - tgx_cookies   → el aviso de cookies ya se aceptó
 *  - tgx_cam       → la cámara del escáner ya se autorizó en este navegador (se abre sola al entrar)
 *  - tgx_cam_dev   → qué cámara se usó (la trasera del móvil, la webcam…)
 */
const UN_ANIO = 60 * 60 * 24 * 365;

export function leerCookie(nombre: string): string | null {
  if (typeof document === "undefined") return null;
  const par = document.cookie.split("; ").find(c => c.startsWith(nombre + "="));
  return par ? decodeURIComponent(par.slice(nombre.length + 1)) : null;
}

export function guardarCookie(nombre: string, valor: string, maxAge = UN_ANIO) {
  if (typeof document === "undefined") return;
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${nombre}=${encodeURIComponent(valor)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${seguro}`;
}

export function borrarCookie(nombre: string) {
  guardarCookie(nombre, "", 0);
}
