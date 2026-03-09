// Lightweight Postgres client wrapper using the 'postgres' package
// Usage:
//  - set DATABASE_URL in your environment (see `.env.example`)
//  - import sql from './server/db.js' and use it for queries
// Example DATABASE_URL:
//  postgresql://postgres:[YOUR_PASSWORD]@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=/path/to/root.crt

import { setDefaultResultOrder } from 'node:dns'
import dns from 'node:dns/promises'
import postgres from 'postgres'
import pg from 'pg'

const FORCE_DB_IPV4 = String(process.env.FORCE_DB_IPV4 ?? 'false').toLowerCase() === 'true'
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

const DB_CONNECTION_SOURCES = [
  { key: 'DATABASE_POOLER_URL', type: 'pooler' },
  { key: 'SUPABASE_DB_POOLER_URL', type: 'pooler' },
  { key: 'SUPABASE_DB_URL', type: 'direct' },
  { key: 'DATABASE_URL', type: 'direct' }
]

const resolveConnectionSource = () => {
  for (const source of DB_CONNECTION_SOURCES) {
    const value = process.env[source.key]
    if (value && value.trim()) {
      return { ...source, value: value.trim() }
    }
  }
  return { key: 'DATABASE_URL', type: 'direct', value: process.env.DATABASE_URL || '' }
}

const connectionSource = resolveConnectionSource()

if (!connectionSource.value) {
  console.warn('[server/db] No database connection string detected. Set DATABASE_POOLER_URL (preferred) or DATABASE_URL.')
}

async function initializeConnectionMetadata (rawConnectionString, source = {}) {
  const metadata = {
    connectionString: rawConnectionString || '',
    forcedIpv4: false,
    originalHost: null,
    originalPort: null,
    resolvedHost: null,
    finalHostUsed: null,
    lookupError: null,
    error: null,
    source
  }

  if (!rawConnectionString) {
    return metadata
  }

  try {
    const url = new URL(rawConnectionString)
    metadata.originalHost = url.hostname
    metadata.connectionString = url.toString()
    metadata.originalPort = url.port ? Number(url.port) : null

    if (FORCE_DB_IPV4 && shouldForceIpv4(url.hostname) && typeof dns.lookup === 'function') {
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

    try {
      const finalUrl = new URL(metadata.connectionString)
      metadata.finalHostUsed = finalUrl.hostname
    } catch {
      metadata.finalHostUsed = metadata.resolvedHost ?? metadata.originalHost
    }
  } catch (error) {
    metadata.error = error
    console.error('[server/db] Failed to parse DATABASE_URL', error)
  }

  console.info('[server/db] connection_metadata', {
    sourceEnv: metadata.source?.key ?? null,
    sourceType: metadata.source?.type ?? null,
    forcedIpv4: metadata.forcedIpv4,
    originalHost: metadata.originalHost,
    originalPort: metadata.originalPort,
    resolvedHost: metadata.resolvedHost,
    finalHostUsed: metadata.finalHostUsed,
    lookupError: metadata.lookupError ? metadata.lookupError.message : null
  })

  return metadata
}

const connectionMetadata = await initializeConnectionMetadata(connectionSource.value, connectionSource)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const createPool = () => {
  const connectionString = connectionMetadata.connectionString || process.env.DATABASE_URL || ''
  const pool = new Pool({
    connectionString,
    ssl:
      connectionString && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : undefined,
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

export async function testConnection (retries = 3) {
  try {
    const client = await pool.connect()
    client.release()
    return true
  } catch (error) {
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
    connectionString && !connectionString.includes('localhost')
      ? {
          rejectUnauthorized: false,
        }
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
        console.info('db_client_ready', {
          host,
          port,
          database,
          user,
          connectionSource: connectionMetadata.source?.key ?? null,
          usingPooler: connectionMetadata.source?.type === 'pooler',
          forcedIpv4: connectionMetadata.forcedIpv4 || false,
          originalHost: connectionMetadata.originalHost,
          finalHostUsed: connectionMetadata.finalHostUsed
        })
      }
    } catch (error) {
      console.warn('[server/db] Unable to log database connection metadata', error)
    }
  } else {
    console.warn('[server/db] Connection metadata reported an error', {
      message: connectionMetadata.error?.message || String(connectionMetadata.error),
      originalHost: connectionMetadata.originalHost
    })
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
  await testConnection()
  dbStartupHealthy = true
  console.info('[server/db] initial_connection_ready')
} catch (error) {
  dbStartupHealthy = false
  console.error('[server/db] initial_connection_failed', {
    message: error?.message || String(error),
    code: error?.code || null
  })
}

export default sql
