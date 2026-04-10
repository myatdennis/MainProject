// Lightweight Postgres client wrapper using the 'postgres' package
// Usage:
//  - set DATABASE_URL in your environment (see `.env.example`)
//  - import sql from './server/db.js' and use it for queries
// Example DATABASE_URL:
//  postgresql://postgres:[YOUR_PASSWORD]@db.eprsgmfzqjptfywoecuy.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=/path/to/root.crt

import { setDefaultResultOrder } from 'node:dns'
import dns from 'node:dns/promises'
import postgres from 'postgres'
import pg from 'pg'

const FORCE_DB_IPV4 = String(process.env.FORCE_DB_IPV4 ?? 'false').toLowerCase() === 'true'
const isProductionEnv = (process.env.NODE_ENV || '').toLowerCase() === 'production'
const isTestEnv = (process.env.NODE_ENV || '').toLowerCase() === 'test'
const shouldLogDbDiagnostics =
  (!isProductionEnv && !isTestEnv) || String(process.env.DEBUG_DB || '').toLowerCase() === 'true'
// Allow self-signed DB certificates in non-production environments or when
// explicitly requested via env. Also honor DEV_FALLBACK and E2E_TEST_MODE so
// local/E2E runs don't fail due to TLS chain issues during health probes.
const defaultAllowSelfSigned =
  !isProductionEnv ||
  String(process.env.DEV_FALLBACK || '').toLowerCase() === 'true' ||
  String(process.env.E2E_TEST_MODE || '').toLowerCase() === 'true'
const requestedAllowSelfSigned =
  String(process.env.ALLOW_DB_SELF_SIGNED ?? String(defaultAllowSelfSigned)).toLowerCase() === 'true'
const { Pool } = pg

if (typeof setDefaultResultOrder === 'function') {
  try {
    setDefaultResultOrder('ipv4first')
  } catch (error) {
    console.warn('[server/db] Failed to set DNS default result order', error)
  }
}

const isIpv4Literal = (host) => /^\d+\.\d+\.\d+\.\d+$/.test(host || '')
const shouldForceIpv4 = (host) => Boolean(host) && host !== 'localhost' && host !== '127.0.0.1' && !isIpv4Literal(host)

const PG_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

const DB_CONNECTION_SOURCES = [
  { key: 'DATABASE_POOLER_URL', type: 'pooler' },
  { key: 'SUPABASE_DB_POOLER_URL', type: 'pooler' },
  { key: 'SUPABASE_DB_URL', type: 'direct' },
  { key: 'DATABASE_URL', type: 'direct' }
]

const validateConnectionString = (value, sourceKey) => {
  if (!value) {
    return false;
  }
  try {
    const parsed = new URL(value);
    const protocol = (parsed.protocol || '').toLowerCase();
    if (!PG_PROTOCOLS.has(protocol)) {
      throw new Error(`Unsupported protocol "${parsed.protocol || 'unknown'}" (expected postgres:// or postgresql://)`);
    }
    if (!parsed.hostname) {
      throw new Error('Missing hostname');
    }
    if (!parsed.username) {
      console.warn('[server/db] connection_string_missing_username', { env: sourceKey });
    }
    return true;
  } catch (error) {
    console.error('[server/db] invalid_connection_string', {
      env: sourceKey,
      message: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
};

const resolveConnectionSource = () => {
  const candidates = []
  for (const source of DB_CONNECTION_SOURCES) {
    const raw = process.env[source.key]
    if (!raw || !raw.trim()) {
      candidates.push({ key: source.key, provided: false, valid: false, selected: false })
      continue
    }
    const trimmed = raw.trim()
    const valid = validateConnectionString(trimmed, source.key)
    candidates.push({ key: source.key, provided: true, valid, selected: false })
    if (!valid) {
      continue
    }
    candidates[candidates.length - 1].selected = true
    return { ...source, value: trimmed, candidates }
  }
  const fallback = process.env.DATABASE_URL || ''
  const validFallback = Boolean(fallback && validateConnectionString(fallback, 'DATABASE_URL'))
  candidates.push({
    key: 'DATABASE_URL',
    provided: Boolean(fallback),
    valid: validFallback,
    selected: validFallback
  })
  return {
    key: 'DATABASE_URL',
    type: 'direct',
    value: validFallback ? fallback.trim() : '',
    candidates
  }
}

const connectionSource = resolveConnectionSource()

const RELAX_POOLER_TLS =
  String(process.env.RELAX_POOLER_TLS ?? 'true').toLowerCase() === 'true'
const autoAllowSelfSignedForPooler =
  RELAX_POOLER_TLS && connectionSource?.type === 'pooler'
const ALLOW_DB_SELF_SIGNED = autoAllowSelfSignedForPooler || (!isProductionEnv && requestedAllowSelfSigned)

if (isProductionEnv && requestedAllowSelfSigned) {
  console.warn('[server/db] Ignoring ALLOW_DB_SELF_SIGNED=true in production; strict TLS verification is enforced.')
}

if (autoAllowSelfSignedForPooler) {
  if (shouldLogDbDiagnostics) {
    console.info('[server/db] TLS relaxation enabled for Supabase pooler connection.', {
      sourceEnv: connectionSource?.key ?? null,
      sourceType: connectionSource?.type ?? null,
      relaxPoolerTls: RELAX_POOLER_TLS,
    })
  }
}

if (connectionSource.candidates) {
  if (shouldLogDbDiagnostics) {
    console.info('[server/db] connection_source_selected', {
      selectedEnv: connectionSource.key,
      sourceType: connectionSource.type,
      hasValue: Boolean(connectionSource.value),
      candidates: connectionSource.candidates,
    })
  }
}

if (!connectionSource.value) {
  console.warn('[server/db] No database connection string detected. Set DATABASE_POOLER_URL (preferred) or DATABASE_URL.')
}

async function initializeConnectionMetadata (rawConnectionString, source = {}) {
  const metadata = {
    connectionString: rawConnectionString || '',
    forcedIpv4: false,
    ipv4RewriteEligible: Boolean(FORCE_DB_IPV4 && source?.type !== 'pooler'),
    originalHost: null,
    originalPort: null,
    resolvedHost: null,
    finalHostUsed: null,
    lookupError: null,
    error: null,
    source,
    projectRef: null,
    selfSignedAllowed: ALLOW_DB_SELF_SIGNED
  }

  if (!rawConnectionString) {
    return metadata
  }

  try {
    const url = new URL(rawConnectionString)
    if (ALLOW_DB_SELF_SIGNED) {
      const currentMode = (url.searchParams.get('sslmode') || '').toLowerCase()
      if (currentMode !== 'no-verify') {
        url.searchParams.set('sslmode', 'no-verify')
        metadata.selfSignedAllowed = true
      }
    }
    metadata.originalHost = url.hostname
    metadata.connectionString = url.toString()
    metadata.originalPort = url.port ? Number(url.port) : null

    if (metadata.ipv4RewriteEligible && shouldForceIpv4(url.hostname) && typeof dns.lookup === 'function') {
      try {
        const lookupResult = await dns.lookup(url.hostname, { family: 4, all: false })
        if (lookupResult?.address) {
          url.hostname = lookupResult.address
          url.host = `${lookupResult.address}${url.port ? `:${url.port}` : ''}`
          metadata.connectionString = url.toString()
          metadata.resolvedHost = lookupResult.address
          metadata.forcedIpv4 = true
        }
      } catch (error) {
        metadata.lookupError = error
        console.warn('[server/db] IPv4 lookup failed; using original host', {
          host: metadata.originalHost,
          message: error?.message || String(error)
        })
      }
    }

    const deriveProjectRefFromConnection = (connectionString) => {
      try {
        const parsed = new URL(connectionString)
        if (parsed.username && parsed.username.includes('.')) {
          const [, maybeRef] = parsed.username.split('.')
          if (maybeRef && /^[a-z0-9]{15,}$/i.test(maybeRef)) {
            return maybeRef.toLowerCase()
          }
        }
        const hostMatch = parsed.hostname.match(/^(?:db\.)?([a-z0-9]{15,})\.supabase\.co$/i)
        if (hostMatch) {
          return hostMatch[1].toLowerCase()
        }
      } catch {
        return null
      }
      return null
    }

    try {
      const finalUrl = new URL(metadata.connectionString)
      metadata.finalHostUsed = finalUrl.hostname
    } catch {
      metadata.finalHostUsed = metadata.resolvedHost ?? metadata.originalHost
    }

    metadata.projectRef = deriveProjectRefFromConnection(metadata.connectionString)
  } catch (error) {
    metadata.error = error
    console.error('[server/db] Failed to parse DATABASE_URL', error)
  }

  if (shouldLogDbDiagnostics) {
    console.info('[server/db] connection_metadata', {
      sourceEnv: metadata.source?.key ?? null,
      sourceType: metadata.source?.type ?? null,
      ipv4RewriteEligible: metadata.ipv4RewriteEligible,
      forcedIpv4: metadata.forcedIpv4,
      originalHost: metadata.originalHost,
      originalPort: metadata.originalPort,
      resolvedHost: metadata.resolvedHost,
      finalHostUsed: metadata.finalHostUsed,
      lookupError: metadata.lookupError ? metadata.lookupError.message : null,
      projectRef: metadata.projectRef,
      selfSignedAllowed: metadata.selfSignedAllowed,
      tlsMode: metadata.selfSignedAllowed ? 'relaxed_pooler_or_nonprod' : 'strict_verify',
    })
  }

  return metadata
}

const connectionMetadata = await initializeConnectionMetadata(connectionSource.value, connectionSource)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const createPool = () => {
  const connectionString = connectionMetadata.connectionString || ''
  const shouldTrustSelfSigned =
    connectionString && !connectionString.includes('localhost') && ALLOW_DB_SELF_SIGNED

  const pool = new Pool({
    connectionString,
    ssl: shouldTrustSelfSigned ? { rejectUnauthorized: false } : undefined,
    family: 4,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT || 30000),
    connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECT_TIMEOUT || 10000),
  })

  pool.on('error', (error) => {
    console.error('[server/db] pool_error', {
      message: error?.message || String(error),
      code: error?.code || null,
      stack: error?.stack || null,
    })
  })

  return pool
}

export const pool = createPool()

export const getDatabaseConnectionInfo = () => ({
  sourceEnv: connectionMetadata.source?.key ?? null,
  sourceType: connectionMetadata.source?.type ?? null,
  host: connectionMetadata.finalHostUsed ?? connectionMetadata.originalHost ?? null,
  port: connectionMetadata.originalPort ?? null,
  forcedIpv4: connectionMetadata.forcedIpv4,
  ipv4RewriteEligible: connectionMetadata.ipv4RewriteEligible,
  connectionStringDefined: Boolean(connectionMetadata.connectionString),
  usingPooler: connectionMetadata.source?.type === 'pooler',
  projectRef: connectionMetadata.projectRef ?? null,
  allowSelfSigned: ALLOW_DB_SELF_SIGNED,
  tlsMode: ALLOW_DB_SELF_SIGNED ? 'relaxed_pooler_or_nonprod' : 'strict_verify'
})

export async function testConnection (retries = 3) {
  try {
    const client = await pool.connect()
    client.release()
    return true
  } catch (error) {
    const sslSelfSigned =
      ALLOW_DB_SELF_SIGNED &&
      (error?.code === 'SELF_SIGNED_CERT_IN_CHAIN' || /self-signed certificate/i.test(error?.message || ''))
    if (sslSelfSigned) {
      console.warn('[server/db] connection_test_self_signed_tolerated', {
        message: error?.message || String(error),
        code: error?.code || null,
        retriesAttempted: (retries ?? 0),
      })
      return true
    }
    if (retries <= 0) {
      console.error('[server/db] connection_test_failed', {
        message: error?.message || String(error),
        code: error?.code || null,
        stack: error?.stack || null,
      })
      throw error
    }
    await wait(2000)
    return testConnection(retries - 1)
  }
}

let sqlClient = null

const ensureSqlClient = () => {
  if (sqlClient) {
    return sqlClient
  }

  const connectionString = connectionMetadata.connectionString
  if (!connectionString) {
    console.warn('[server/db] WARNING: database connection string is not set. Configure DATABASE_POOLER_URL or DATABASE_URL before starting the server.')
  }

  const sslConfig =
    connectionString && !connectionString.includes('localhost') && ALLOW_DB_SELF_SIGNED
      ? { rejectUnauthorized: false }
      : undefined

  try {
    sqlClient = postgres(connectionString || '', {
      max: 5,
      ssl: sslConfig,
      // If you need to pass custom SSL options you can do so via the
      // connection string query params (sslmode, sslrootcert) or by
      // passing an `ssl` option here. Most Supabase instances work with
      // `sslmode=verify-full&sslrootcert=/path/to/root.crt` set in the
      // DATABASE_URL.
    })
  } catch (error) {
    console.error('db_client_init_failed', {
      message: error?.message || String(error)
    })
    throw error
  }

  if (!connectionMetadata.error) {
    try {
      const url = connectionString ? new URL(connectionString) : null
      if (url) {
        const host = url.hostname
        const port = url.port ? Number(url.port) : undefined
        const database = url.pathname.replace(/^\//, '') || undefined
        const user = url.username || undefined
        if (shouldLogDbDiagnostics) {
          console.info('db_client_ready', {
            host,
            port,
            database,
            user,
            connectionSource: connectionMetadata.source?.key ?? null,
            usingPooler: connectionMetadata.source?.type === 'pooler',
            forcedIpv4: connectionMetadata.forcedIpv4 || false,
            originalHost: connectionMetadata.originalHost,
            finalHostUsed: connectionMetadata.finalHostUsed,
            allowSelfSigned: ALLOW_DB_SELF_SIGNED,
            tlsMode: ALLOW_DB_SELF_SIGNED ? 'relaxed_pooler_or_nonprod' : 'strict_verify',
          })
        }
      }
    } catch (error) {
      console.warn('[server/db] Unable to log database connection metadata', error)
    }
  } else {
    if (shouldLogDbDiagnostics) {
      console.warn('[server/db] Connection metadata reported an error', {
        message: connectionMetadata.error?.message || String(connectionMetadata.error),
        originalHost: connectionMetadata.originalHost,
      })
    }
  }

  return sqlClient
}

const sql = new Proxy(function sqlProxy () {}, {
  apply (_target, thisArg, args) {
    return ensureSqlClient().apply(thisArg, args)
  },
  get (_target, prop) {
    const client = ensureSqlClient()
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

export let dbStartupHealthy = false

try {
  if (connectionMetadata.connectionString) {
    await testConnection()
    dbStartupHealthy = true
    if (shouldLogDbDiagnostics) {
      console.info('[server/db] initial_connection_ready')
    }
  } else {
    // Do not attempt connection tests when the DB isn't configured.
    dbStartupHealthy = false
    if (shouldLogDbDiagnostics) {
      console.warn('[server/db] initial_connection_skipped_missing_connection_string')
    }
  }
} catch (error) {
  dbStartupHealthy = false
  if (shouldLogDbDiagnostics) {
    console.error('[server/db] initial_connection_failed', {
      message: error?.message || String(error),
      code: error?.code || null
    })
  }
}

export default sql
