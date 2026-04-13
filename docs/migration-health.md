# Migration Health Snapshot

Generated from `npm run report:migrations` on April 11, 2026.

## Current Summary

- Total migrations: `151`
- Placeholder migrations: `21`
- Repair/hardening migrations: `42`
- Duplicate descriptive migration intents: `5`

## Notable Flags

- Placeholder files still exist and should not grow further before launch freeze.
- Duplicate intent exists for `normalize_documents_updated_trigger`.
- Duplicate intent exists for `fix_function_search_path`.
- Duplicate intent exists for `add_team_huddle_reactions_fk_indexes`.

## Current Constraint

- This report is file-based and does not certify runtime parity with the live Supabase project.
- Full certification is still blocked in this environment by Supabase host resolution failures, so live migration/RLS verification must be rerun once DNS connectivity is restored.

## Command

```bash
npm run report:migrations
```
