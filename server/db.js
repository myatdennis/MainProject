// Lightweight Postgres client wrapper using the 'postgres' package
// Usage:
//  - set DATABASE_URL in your environment (see `.env.example`)
//  - import sql from './server/db.js' and use it for queries
// Example DATABASE_URL:
//  postgresql://postgres:[YOUR_PASSWORD]@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=/path/to/root.crt

import dns from 'dns'
import postgres from 'postgres'

if (typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first')
  } catch (error) {
    console.warn('[server/db] Failed to set DNS default result order', error)
  }
}

let sqlClient = null

const ensureSqlClient = () => {
  if (sqlClient) {
    return sqlClient
  }

  const connectionString = process.env.DATABASE_URL
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
      console.log('[DB CONNECTED]', { host, database, user })
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
