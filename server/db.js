// Lightweight Postgres client wrapper using the 'postgres' package
// Usage:
//  - set DATABASE_URL in your environment (see `.env.example`)
//  - import sql from './server/db.js' and use it for queries
// Example DATABASE_URL:
//  postgresql://postgres:[YOUR_PASSWORD]@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=/path/to/root.crt

import postgres from 'postgres'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.warn('[server/db] WARNING: DATABASE_URL is not set. Create a .env or export DATABASE_URL before starting the server.')
}

// Create a Postgres client. The `postgres` library accepts a connection string
// and optional configuration. We keep the defaults but set a small pool size.
const sql = postgres(connectionString || '', {
  max: 5,
  // If you need to pass custom SSL options you can do so via the
  // connection string query params (sslmode, sslrootcert) or by
  // passing an `ssl` option here. Most Supabase instances work with
  // `sslmode=verify-full&sslrootcert=/path/to/root.crt` set in the
  // DATABASE_URL.
})

export default sql
