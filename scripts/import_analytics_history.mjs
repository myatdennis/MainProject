#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import 'dotenv/config';
import postgres from 'postgres';

const DEFAULT_CHUNK_SIZE = Number(process.env.ANALYTICS_IMPORT_CHUNK_SIZE || 500);

function parseArgs(argv) {
  const opts = {
    file: null,
    dryRun: false,
    chunkSize: DEFAULT_CHUNK_SIZE,
    limit: null,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--file':
      case '-f':
        opts.file = argv[i + 1];
        i += 1;
        break;
      case '--chunk':
        opts.chunkSize = Number(argv[i + 1]) || DEFAULT_CHUNK_SIZE;
        i += 1;
        break;
      case '--limit':
        opts.limit = Number(argv[i + 1]) || null;
        i += 1;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      default:
        if (arg && arg.startsWith('-')) {
          console.warn(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return opts;
}

function normalizeRecord(raw, verbose = false) {
  const eventType = raw.event_type || raw.eventType || raw.type;
  const createdAtInput = raw.created_at || raw.occurred_at || raw.timestamp || raw.time;

  if (!eventType || !createdAtInput) {
    if (verbose) {
      console.warn('[analytics import] Skipping row without event_type/created_at:', raw);
    }
    return null;
  }

  const createdAt = new Date(createdAtInput);
  if (Number.isNaN(createdAt.getTime())) {
    if (verbose) {
      console.warn('[analytics import] Invalid timestamp in row:', createdAtInput);
    }
    return null;
  }

  const payloadCandidate = raw.payload ?? raw.metadata ?? raw.meta ?? raw.data ?? {};
  const payload = typeof payloadCandidate === 'object' && payloadCandidate !== null ? payloadCandidate : { value: payloadCandidate };

  return {
    user_id: raw.user_id || raw.userId || null,
    course_id: raw.course_id || raw.courseId || null,
    lesson_id: raw.lesson_id || raw.lessonId || null,
    module_id: raw.module_id || raw.moduleId || null,
    event_type: String(eventType),
    session_id: raw.session_id || raw.sessionId || null,
    user_agent: raw.user_agent || raw.userAgent || null,
    payload,
    created_at: createdAt.toISOString(),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.file) {
    console.error('Usage: node scripts/import_analytics_history.mjs --file ./path/to/history.jsonl [--dry-run] [--chunk 500] [--limit 10000]');
    process.exit(1);
  }

  const absoluteFile = path.resolve(process.cwd(), options.file);
  if (!fs.existsSync(absoluteFile)) {
    console.error(`History file not found: ${absoluteFile}`);
    process.exit(1);
  }

  if (options.chunkSize <= 0) {
    console.error('Chunk size must be a positive integer');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString && !options.dryRun) {
    console.error('DATABASE_URL is required for live imports. Provide --dry-run to validate files without connecting.');
    process.exit(1);
  }

  const sql = connectionString ? postgres(connectionString, { max: Number(process.env.ANALYTICS_IMPORT_POOL_SIZE || 5) }) : null;
  const stats = {
    processed: 0,
    imported: 0,
    skipped: 0,
    invalid: 0,
  };
  let abortedByLimit = false;

  async function flush(buffer) {
    if (!buffer.length) return;
    if (options.dryRun) {
      stats.imported += buffer.length;
      buffer.length = 0;
      return;
    }

    const valueTuples = buffer.map(
      (row) => sql`(${row.user_id}, ${row.course_id}, ${row.lesson_id}, ${row.module_id}, ${row.event_type}, ${row.session_id}, ${row.user_agent}, ${sql.json(row.payload)}, ${row.created_at})`,
    );
    try {
      await sql`
        insert into analytics_events (user_id, course_id, lesson_id, module_id, event_type, session_id, user_agent, payload, created_at)
        values ${sql(valueTuples)}
      `;
      stats.imported += buffer.length;
    } catch (error) {
      console.error('[analytics import] Failed to insert batch:', error.message || error);
      throw error;
    } finally {
      buffer.length = 0;
    }
  }

  console.log(`${options.dryRun ? '🔍 Dry run for' : '📥 Importing'} analytics history from ${absoluteFile}`);
  const reader = readline.createInterface({
    input: fs.createReadStream(absoluteFile, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const buffer = [];
  try {
    for await (const line of reader) {
      if (abortedByLimit) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      stats.processed += 1;

      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (error) {
        stats.invalid += 1;
        if (options.verbose) {
          console.warn('[analytics import] Skipping invalid JSON line:', trimmed);
        }
        continue;
      }

      const normalized = normalizeRecord(parsed, options.verbose);
      if (!normalized) {
        stats.skipped += 1;
        continue;
      }

      buffer.push(normalized);
      if (options.limit && (stats.imported + buffer.length) >= options.limit) {
        const allowed = Math.max(options.limit - stats.imported, 0);
        if (allowed < buffer.length) {
          buffer.length = allowed;
        }
        abortedByLimit = true;
      }

      if (buffer.length >= options.chunkSize) {
        await flush(buffer);
      }
    }

    if (!abortedByLimit && buffer.length) {
      await flush(buffer);
    } else if (abortedByLimit && buffer.length) {
      await flush(buffer);
    }
  } catch (error) {
    console.error('[analytics import] Failed:', error.message || error);
    process.exitCode = 1;
  } finally {
    reader.close();
    if (sql) {
      await sql.end({ timeout: 1000 }).catch((err) => {
        console.warn('[analytics import] Failed to close connection pool cleanly:', err.message || err);
      });
    }
  }

  console.log('--- Import summary ---');
  console.log(`Processed lines : ${stats.processed}`);
  console.log(`Valid rows      : ${stats.processed - stats.invalid}`);
  console.log(`Skipped rows    : ${stats.skipped}`);
  console.log(`Imported rows   : ${stats.imported}${options.dryRun ? ' (simulated)' : ''}`);
  if (abortedByLimit) {
    console.log(`Stopped early after reaching --limit=${options.limit}`);
  }
  console.log(options.dryRun ? 'Dry run complete.' : 'Analytics history import finished.');
}

main();
