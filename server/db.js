// Lightweight Postgres client wrapper using the 'postgres' package
// Usage:
//  - set DATABASE_URL in your environment (see `.env.example`)
//  - import sql from './server/db.js' and use it for queries
// Example DATABASE_URL:
//  postgresql://postgres:[YOUR_PASSWORD]@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=/path/to/root.crt

import { setDefaultResultOrder } from 'node:dns'
import dns from 'node:dns/promises'
import postgres from 'postgres'

const FORCE_DB_IPV4 = String(process.env.FORCE_DB_IPV4 ?? 'true').toLowerCase() !== 'false'

if (typeof setDefaultResultOrder === 'function') {
  try {
    setDefaultResultOrder('ipv4first')
  } catch (error) {
    console.warn('[server/db] Failed to set DNS default result order', error)
  }
}

const isIpv4Literal = (host) => /^\d+\.\d+\.\d+\.\d+$/.test(host || '')
const shouldForceIpv4 = (host) => Boolean(host) && host !== 'localhost' && host !== '127.0.0.1' && !isIpv4Literal(host)

async function initializeConnectionMetadata (rawConnectionString) {
  const metadata = {
    connectionString: rawConnectionString || '',
    forcedIpv4: false,
    originalHost: null,
    resolvedHost: null
  }

  if (!rawConnectionString) {
    return metadata
  }

  try {
    const url = new URL(rawConnectionString)
    metadata.originalHost = url.hostname
    metadata.resolvedHost = url.hostname

    if (!FORCE_DB_IPV4 || !shouldForceIpv4(url.hostname) || typeof dns.lookup !== 'function') {
      return metadata
    }

    try {
      const lookupResult = await dns.lookup(url.hostname, { family: 4, verbatim: false })
      if (lookupResult?.address) {
        url.hostname = lookupResult.address
        url.host = `${lookupResult.address}${url.port ? `:${url.port}` : ''}`
        metadata.connectionString = url.toString()
        metadata.resolvedHost = lookupResult.address
        metadata.forcedIpv4 = true
        console.info('[server/db] Forced IPv4 host for DATABASE_URL', {
          originalHost: metadata.originalHost,
          resolvedHost: metadata.resolvedHost
        })
      }
    } catch (error) {
      console.warn('[server/db] Unable to resolve IPv4 host for DATABASE_URL', {
        host: url.hostname,
        message: error?.message || String(error)
      })
    }
  } catch (error) {
    console.warn('[server/db] Failed to parse DATABASE_URL', error)
  }

  return metadata
}

const connectionMetadata = await initializeConnectionMetadata(process.env.DATABASE_URL || '')

let sqlClient = null

const ensureSqlClient = () => {
  if (sqlClient) {
    return sqlClient
  }

  const connectionString = connectionMetadata.connectionString
  if (!connectionString) {
    console.warn('[server/db] WARNING: DATABASE_URL is not set. Create a .env or export DATABASE_URL before starting the server.')
  }

  const sslConfig =
    connectionString && !connectionString.includes('localhost')
      ? {
          rejectUnauthorized: false,
        }
      : undefined

  sqlClient = postgres(connectionString || '', {
    max: 5,
    ssl: sslConfig,
    // If you need to pass custom SSL options you can do so via the
    // connection string query params (sslmode, sslrootcert) or by
    // passing an `ssl` option here. Most Supabase instances work with
    // `sslmode=verify-full&sslrootcert=/path/to/root.crt` set in the
    // DATABASE_URL.
  })

  try {
    const url = connectionString ? new URL(connectionString) : null
    if (url) {
      const host = url.hostname
      const database = url.pathname.replace(/^\//, '') || undefined
      const user = url.username || undefined
      console.log('[DB CONNECTED]', {
        host,
        database,
        user,
        forcedIpv4: connectionMetadata.forcedIpv4 || false,
        originalHost: connectionMetadata.originalHost
      })
    }
  } catch (error) {
    console.warn('[server/db] Unable to log database connection metadata', error)
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

export default sql
