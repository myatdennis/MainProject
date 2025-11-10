#!/usr/bin/env node
/*
  Runs a SQL migration file using node-postgres (no psql required).
  Usage:
    DATABASE_URL='postgres://user:pass@host:port/db' node scripts/run_migration_node.js supabase/migrations/20251108_add_analytics_tables_and_views.sql

  This script reads the SQL file and executes it as a single query. It requires a DB user with rights to create tables/views/functions.
*/
import fs from 'fs'
import sql from '../server/db.js'

const migrationFile = process.argv[2]
if (!migrationFile) {
  console.error('Usage: node scripts/run_migration_node.js <migration-file.sql>')
  process.exit(2)
}

if (!process.env.DATABASE_URL) {
  console.error('Please set DATABASE_URL env var (postgres://user:pass@host:port/db)')
  process.exit(2)
}

async function run() {
  try {
    console.log(`Connected (via postgres lib). Running migration ${migrationFile}...`)
    const sqlText = fs.readFileSync(migrationFile, 'utf8')
    // Use unsafe to run raw SQL migration file which may contain multiple statements
    await sql.unsafe(sqlText)
    console.log('Migration applied successfully.')
  } catch (err) {
    console.error('Migration failed:', err.message || err)
    process.exitCode = 1
  }
}

run()
