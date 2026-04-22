Purpose

This small helper automates a single reproduction request and extracts the server-side log blocks needed to diagnose a Postgres RLS (42501) failure during assignments materialization.

Files

- scripts/capture_rls_failure.sh — shell script that sends one request with a unique X-Request-Id and greps the server log for the three structured log keys. It prints the matching lines for easy copy/paste.

Prerequisites

- A running server that writes structured logs to a file (default: server.log in project root). If your server is currently running as a task in your editor, restart it with logs redirected:

  npm run start:server > server.log 2>&1 &

- A valid JWT (user or admin) for the endpoint you will hit.

- The organization id (ORG_ID) to include in the request.

How to run

1) From the repo root, run the script with the environment variables set. Replace placeholders.

```bash
TOKEN=<JWT> ORG_ID=<ORG_ID> ./scripts/capture_rls_failure.sh /api/client/surveys/assigned
```

Or for admin listing:

```bash
TOKEN=<ADMIN_JWT> ORG_ID=<ORG_ID> ./scripts/capture_rls_failure.sh "/api/admin/surveys?orgId=<ORG_ID>"
```

2) The script will perform exactly one request and then print grep results for these log keys:

- rls_context_materialize_start
- client_assigned_materialize_trigger
- survey_assignments_materialize_failed
- course_assignments_materialize_failed

3) Copy the printed blocks (exact JSON lines) and paste them into the issue or reply back. Make sure the failure block includes `code` === "42501", `insertPreview`, `insertCount`, and `role`.

Notes & Troubleshooting

- If the script prints nothing for the grep sections, confirm that the server is writing logs to the path referenced by `LOG_FILE` (defaults to `server.log`). You can override by exporting `LOG_FILE` before running the script.

- If the server is started from the editor/task runner instead of the script, either restart it with stdout redirected or copy the relevant lines from the editor's terminal.

- Do NOT run the script more than once per capture (we want one request -> one log block).

Security

- The script will print log snippets that may include user ids or organization ids. Do not paste JWTs or other secrets into issue text. Redact tokens if needed.

After you paste logs

I will identify which RLS policy is blocking, whether the server used the service role, and the minimal secure remediation (policy SQL or server code change) with validation steps.
