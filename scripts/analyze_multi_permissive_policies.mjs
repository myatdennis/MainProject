#!/usr/bin/env node
import sql from '../server/db.js';

// This script lists permissive policies and groups them by schema/table/role/action.
// It prints suggested consolidation SQL that combines their USING conditions with OR.

function normalizeRole(role) {
  // role might be 'authenticated' or '"authenticated"' depending on representation
  return String(role).replace(/^"|"$/g, '');
}

async function run() {
  try {
  // permissive in some PG versions / drivers may be text like 'PERMISSIVE' instead of boolean
  // select permissive as-is and filter in JS for robustness
  const rows = await sql`select schemaname, tablename, policyname, roles, cmd as action, qual, with_check, permissive from pg_policies order by schemaname, tablename`;
    if (!rows || rows.length === 0) {
      console.log('No permissive policies found.');
      return;
    }

    // Build map: key = `${schemaname}.${tablename}::${role}::${action}`
    const map = new Map();
    for (const r of rows) {
      // permissive may be stored as 'PERMISSIVE' or boolean true
      const perm = r.permissive;
      const isPermissive = (perm !== null && perm !== undefined) && String(perm).toLowerCase().includes('perm');
      if (!isPermissive) continue;

      const rolesRaw = r.roles;
      let roleList = [];
      if (Array.isArray(rolesRaw)) {
        roleList = rolesRaw;
      } else if (typeof rolesRaw === 'string') {
        // Could be '{a,b}' or 'a' — try to normalize
        const trimmed = rolesRaw.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          roleList = trimmed.slice(1, -1).split(',').map((s) => s.trim());
        } else if (trimmed.length > 0) {
          roleList = [trimmed];
        } else {
          roleList = [];
        }
      } else if (rolesRaw == null) {
        roleList = [];
      } else {
        // fallback: try to coerce
        roleList = [String(rolesRaw)];
      }

      for (const role of roleList) {
        const roleName = normalizeRole(role);
        const key = `${r.schemaname}.${r.tablename}::${roleName}::${r.action}`;
        if (!map.has(key)) map.set(key, { schemaname: r.schemaname, tablename: r.tablename, role: roleName, action: r.action, policies: [] });
        map.get(key).policies.push({ policyname: r.policyname, qual: r.qual, with_check: r.with_check });
      }
    }

    const problems = [];
    for (const [key, group] of map.entries()) {
      if (group.policies.length > 1) problems.push(group);
    }

    if (problems.length === 0) {
      console.log('No tables with multiple permissive policies detected.');
      return;
    }

    for (const g of problems) {
      console.log('\n----');
      console.log(`Table: ${g.schemaname}.${g.tablename}`);
      console.log(`Role: ${g.role}`);
      console.log(`Action: ${g.action}`);
      console.log('Policies:');
      g.policies.forEach((p) => {
        console.log(`  - ${p.policyname}    qual=${p.qual ? p.qual.replace(/\n+/g, ' ') : '<null or unconditional>'}`);
      });

      // Build suggested consolidation using OR of quals. If any qual is null or empty, it means the policy is unconditional --> warn and skip consolidation suggestion.
      const anyUnconditional = g.policies.some((p) => !p.qual || String(p.qual).trim() === '' || String(p.qual).toLowerCase() === 'true');
      if (anyUnconditional) {
        console.log('\nWARNING: At least one policy appears unconditional (no USING qual). Consolidation would result in a broadly permissive policy. Review manually.');
        console.log('Suggested action: remove or tighten unconditional policy or convert other policies into more restrictive combined policy.');
      } else {
        const quals = g.policies.map((p) => `(${p.qual})`);
        // concat with OR
        const combinedUse = quals.join(' OR ');
        // For WITH CHECK, combine with OR as well if present
        const checks = g.policies.map((p) => p.with_check).filter(Boolean);
        const combinedCheck = checks.length ? checks.map((c) => `(${c})`).join(' OR ') : null;

        const suggestedPolicyName = `consolidated_${g.role}_${g.action.toLowerCase()}`.replace(/[^a-zA-Z0-9_]/g, '_');
        console.log('\nSuggested consolidation SQL (review before running):');
        console.log(`-- Drop the old policies (optional; keep backup until tested)`);
        g.policies.forEach((p) => console.log(`-- DROP POLICY IF EXISTS ${p.policyname} ON ${g.schemaname}.${g.tablename};`));
        console.log('\n-- Create one consolidated policy combining the USING conditions:');
        console.log(`CREATE POLICY ${suggestedPolicyName} ON ${g.schemaname}.${g.tablename} FOR ${g.action.toUpperCase()} TO ${g.role} USING (${combinedUse})${combinedCheck ? ` WITH CHECK (${combinedCheck})` : ''};`);
        console.log('\n-- After verifying behavior, you can DROP the old policies and rename this policy if desired.');
      }
    }

  } catch (err) {
    console.error('Error analyzing policies:', err?.message || String(err));
    process.exitCode = 1;
  } finally {
    await sql.end?.();
  }
}

run();
