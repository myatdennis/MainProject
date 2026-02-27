import { decodeProtectedHeader, createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { LRUCache } from 'lru-cache';

const rawSupabaseUrl = (process.env.SUPABASE_URL ?? '').trim();
const SUPABASE_URL = rawSupabaseUrl ? rawSupabaseUrl.replace(/\/+$/, '') : '';
const SUPABASE_JWT_SECRET = (process.env.SUPABASE_JWT_SECRET ?? '').trim();

const SUPABASE_JWKS_URL = SUPABASE_URL ? new URL('/auth/v1/.well-known/jwks.json', SUPABASE_URL) : null;
const SUPABASE_ISSUER = SUPABASE_URL
  ? new URL('/auth/v1', SUPABASE_URL).toString().replace(/\/+$/, '')
  : '';

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;

const jwksCache = new LRUCache<string, ReturnType<typeof createRemoteJWKSet>>({
  max: 1,
  ttl: JWKS_CACHE_TTL_MS,
});
const JWKS_CACHE_KEY = 'supabase';

function getRemoteJwks() {
  if (!SUPABASE_JWKS_URL) {
    throw new Error('[supabaseJwt] SUPABASE_URL is not set; cannot resolve JWKS endpoint.');
  }
  const cached = jwksCache.get(JWKS_CACHE_KEY);
  if (cached) return cached;
  const client = createRemoteJWKSet(SUPABASE_JWKS_URL);
  jwksCache.set(JWKS_CACHE_KEY, client);
  return client;
}

function getHs256Secret() {
  if (!SUPABASE_JWT_SECRET) {
    throw new Error("[supabaseJwt] HS256 token received but SUPABASE_JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(SUPABASE_JWT_SECRET);
}

export type VerifiedSupabaseJwt = JWTPayload & {
  sub?: string;
  role?: string;
  email?: string;
};

export async function verifySupabaseJwt(
  token: string,
  opts?: {
    audience?: string | string[];
    issuer?: string;
    clockToleranceSeconds?: number;
  }
): Promise<VerifiedSupabaseJwt> {
  if (!token) throw new Error("[supabaseJwt] Missing bearer token");

  if (!SUPABASE_URL || !SUPABASE_JWKS_URL || !SUPABASE_ISSUER) {
    throw new Error("[supabaseJwt] SUPABASE_URL is not set (expected https://<project>.supabase.co)");
  }

  const header = decodeProtectedHeader(token);
  const alg = (header.alg ?? "").toUpperCase();
  const kid = header.kid;

  if (!alg) throw new Error("[supabaseJwt] Token missing alg header");
  if (alg === "NONE") throw new Error('[supabaseJwt] Token alg "none" is not allowed');

  const issuer = opts?.issuer ?? SUPABASE_ISSUER;
  const audience = opts?.audience ?? "authenticated";
  const clockTolerance = opts?.clockToleranceSeconds ?? 5;

  try {
    // Symmetric (legacy / custom) cases
    if (alg === "HS256") {
      const { payload } = await jwtVerify(token, getHs256Secret(), {
        algorithms: ["HS256"],
        issuer,
        audience,
        clockTolerance,
      });
      return payload as VerifiedSupabaseJwt;
    }

    // Asymmetric (Supabase default): ES256 or RS256 (sometimes others)
    if (alg === "ES256" || alg === "RS256") {
      const remoteJwks = getRemoteJwks();
      const allowedAlgorithms = alg === "ES256" ? ["ES256"] : ["RS256"];
      const { payload } = await jwtVerify(token, remoteJwks, {
        algorithms: allowedAlgorithms,
        issuer,
        audience,
        clockTolerance,
      });
      return payload as VerifiedSupabaseJwt;
    }

    throw new Error(`[supabaseJwt] Unsupported alg "${header.alg}" (kid=${kid ?? "none"})`);
  } catch (err: any) {
    // If JWKS fetch/parse fails, clear cache so next request refetches
    const code = err?.code ?? "";
    if (typeof code === "string" && code.startsWith("ERR_JWKS")) {
      jwksCache.delete(JWKS_CACHE_KEY);
    }

    // Create clear messages
    if (err?.code === "ERR_JWT_EXPIRED") {
      throw new Error("[supabaseJwt] Token expired");
    }
    if (err?.code === "ERR_JWT_CLAIM_INVALID" && err?.claim === "iss") {
      throw new Error(
        `[supabaseJwt] issuer mismatch. expected="${issuer}" received="${err?.claimValue}"`
      );
    }
    if (err?.code === "ERR_JWT_CLAIM_INVALID" && err?.claim === "aud") {
      throw new Error(
        `[supabaseJwt] audience mismatch. expected="${audience}" received="${err?.claimValue}"`
      );
    }

    throw new Error(`[supabaseJwt] Token verification failed (alg=${alg}, kid=${kid ?? "none"}): ${err?.message ?? err}`);
  }
}
