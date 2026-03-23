// QR token utilities for The Garden X
// New system: QR contains an 8-char alphanumeric token, data lives in Supabase
// Legacy: XOR-encrypted JSON payload (backward compatible)

const QR_SECRET = "3LJ4RD1N_PILOTX_2025";

function deriveKey(secret: string, length: number): number[] {
  const key: number[] = [];
  for (let i = 0; i < length; i++) {
    key.push(secret.charCodeAt(i % secret.length));
  }
  return key;
}

const SHORT_TOKEN_RE = /^[a-z0-9]{6,60}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true if the token is a short alphanumeric token (new system) or UUID */
export function isShortToken(token: string): boolean {
  const t = token.trim();
  return SHORT_TOKEN_RE.test(t) || UUID_RE.test(t);
}

/** Decode a legacy XOR-encrypted token */
export function decodeQRToken(token: string): Record<string, unknown> {
  const raw = token.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = deriveKey(QR_SECRET, bytes.length);
  const decoded = bytes.map((b, i) => b ^ key[i]);
  const json = new TextDecoder().decode(decoded);
  return JSON.parse(json);
}

/** Check if a token is valid (short token, UUID, or decodable legacy) */
export function isValidQRToken(token: string): boolean {
  if (isShortToken(token)) return true;
  try {
    decodeQRToken(token);
    return true;
  } catch {
    return false;
  }
}
