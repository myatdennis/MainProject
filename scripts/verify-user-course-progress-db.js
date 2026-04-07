#!/usr/bin/env node

import { getDatabaseConnectionInfo, pool } from '../server/db.js';

const printHeader = () => {
  console.log('USER_COURSE_PROGRESS DB VERIFICATION');
};

const formatConnectionSource = (info) => {
  const source = info?.sourceEnv || 'unknown';
  const type = info?.sourceType || 'unknown';
  const host = info?.host || 'n/a';
  const port = info?.port || 'n/a';
  return `${source} (${type}) @ ${host}:${port}`;
};

const failMissingEnv = (connectionInfo) => {
  printHeader();
  console.log(`connection_source: ${formatConnectionSource(connectionInfo)}`);
  console.log('error: Database connection is not configured.');
  console.log('hint: Set DATABASE_POOLER_URL (preferred) or DATABASE_URL, then re-run this script.');
  console.log('VERDICT: FAIL');
  process.exitCode = 2;
};

const main = async () => {
  const connectionInfo = getDatabaseConnectionInfo();
  if (!connectionInfo?.connectionStringDefined) {
    failMissingEnv(connectionInfo);
    return;
  }

  let client;
  try {
    client = await pool.connect();

    const duplicateGroupsResult = await client.query(`
      SELECT COUNT(*)::bigint AS duplicate_group_count
      FROM (
        SELECT user_id, course_id
        FROM public.user_course_progress
        GROUP BY user_id, course_id
        HAVING COUNT(*) > 1
      ) t;
    `);

    const duplicateRowsResult = await client.query(`
      SELECT COALESCE(SUM(cnt - 1), 0)::bigint AS duplicate_row_count
      FROM (
        SELECT COUNT(*) AS cnt
        FROM public.user_course_progress
        GROUP BY user_id, course_id
        HAVING COUNT(*) > 1
      ) t;
    `);

    const totalRowsResult = await client.query(`
      SELECT COUNT(*)::bigint AS total_rows
      FROM public.user_course_progress;
    `);

    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'user_course_progress'
      ORDER BY indexname;
    `);

    const constraintsResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'public.user_course_progress'::regclass
      ORDER BY conname;
    `);

    const duplicateGroupCount = Number(duplicateGroupsResult.rows?.[0]?.duplicate_group_count || 0);
    const duplicateRowCount = Number(duplicateRowsResult.rows?.[0]?.duplicate_row_count || 0);
    const totalRows = Number(totalRowsResult.rows?.[0]?.total_rows || 0);
    const indexes = indexesResult.rows || [];
    const constraints = constraintsResult.rows || [];

    const hasUserCourseProgressUnique = indexes.some((row) => row.indexname === 'user_course_progress_unique');
    const hasPrimaryKeyConstraint = constraints.some((row) => row.conname === 'user_course_progress_pkey');
    const hasRemainingDuplicates = duplicateGroupCount > 0 || duplicateRowCount > 0;
    const verdict = !hasRemainingDuplicates && hasUserCourseProgressUnique ? 'PASS' : 'FAIL';

    printHeader();
    console.log(`connection_source: ${formatConnectionSource(connectionInfo)}`);
    console.log(`total_rows: ${totalRows}`);
    console.log(`duplicate_group_count: ${duplicateGroupCount}`);
    console.log(`duplicate_row_count: ${duplicateRowCount}`);
    console.log(`has_user_course_progress_unique: ${hasUserCourseProgressUnique}`);
    console.log(`has_primary_key_constraint: ${hasPrimaryKeyConstraint}`);
    console.log(`has_remaining_duplicates: ${hasRemainingDuplicates}`);

    console.log('indexes:');
    if (indexes.length === 0) {
      console.log('- (none)');
    } else {
      for (const row of indexes) {
        console.log(`- ${row.indexname}: ${row.indexdef}`);
      }
    }

    console.log('constraints:');
    if (constraints.length === 0) {
      console.log('- (none)');
    } else {
      for (const row of constraints) {
        console.log(`- ${row.conname}: ${row.def}`);
      }
    }

    console.log(`VERDICT: ${verdict}`);
    process.exitCode = verdict === 'PASS' ? 0 : 1;
  } catch (error) {
    printHeader();
    console.log(`connection_source: ${formatConnectionSource(connectionInfo)}`);
    console.log(`error: ${error?.message || String(error)}`);
    console.log('VERDICT: FAIL');
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end().catch(() => {});
  }
};

main();
