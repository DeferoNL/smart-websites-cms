// Central Defero sign-in tickets: signed by the master (ECDSA P-256), verified by each client site.
// Browser- and worker-safe (WebCrypto only).
export const SSO_TICKET_TTL_S = 60;
export const SSO_STEP_UP_S = 12 * 60 * 60;
export type SsoTicket = { iss: string; aud: string; sub: string; iat: number; exp: number; jti: string };

const enc = new TextEncoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIG = { name: 'ECDSA', hash: 'SHA-256' } as const;

export async function signTicket(privateJwk: JsonWebKey, t: SsoTicket) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, ALG, false, ['sign']);
  const body = b64u(enc.encode(JSON.stringify(t)));
  const sig = new Uint8Array(await crypto.subtle.sign(SIG, key, enc.encode(body)));
  return `${body}.${b64u(sig)}`;
}

/** Returns the ticket only when signature, audience (one of the site's hosts), lifetime and superadmin subject are valid. */
export async function verifyTicket(publicJwk: JsonWebKey, token: string, opts: { hosts: string[]; now: number; allowed: (email: string) => boolean }): Promise<SsoTicket | null> {
  try {
    const [body, sig, extra] = token.split('.');
    if (!body || !sig || extra !== undefined || token.length > 2000) return null;
    const key = await crypto.subtle.importKey('jwk', publicJwk, ALG, false, ['verify']);
    if (!(await crypto.subtle.verify(SIG, key, unb64u(sig), enc.encode(body)))) return null;
    const t = JSON.parse(new TextDecoder().decode(unb64u(body))) as SsoTicket;
    const now = Math.floor(opts.now / 1000);
    if (typeof t.exp !== 'number' || typeof t.iat !== 'number' || t.exp < now || t.iat > now + 5 || t.exp - t.iat > SSO_TICKET_TTL_S) return null;
    const hosts = opts.hosts.filter(Boolean).map(h => h.toLowerCase());
    if (typeof t.aud !== 'string' || !hosts.includes(t.aud.toLowerCase())) return null;
    if (typeof t.sub !== 'string' || !opts.allowed(t.sub)) return null;
    return t;
  } catch { return null; }
}

/** Step-up: a Google (oauth) or two-factor sign-in must have happened recently before issuing tickets. */
export function recentStrongSignIn(claims: { aal?: unknown; amr?: unknown }, now: number) {
  const amr = Array.isArray(claims.amr) ? (claims.amr as { method?: string; timestamp?: number }[]) : [];
  const nowS = Math.floor(now / 1000);
  return amr.some(a => (a.method === 'oauth' || a.method === 'totp' || claims.aal === 'aal2' && a.method === 'password')
    && typeof a.timestamp === 'number' && nowS - a.timestamp <= SSO_STEP_UP_S);
}
