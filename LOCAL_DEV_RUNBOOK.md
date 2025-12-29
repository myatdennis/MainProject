# Local Dev Runbook

This guide keeps the local setup lightweight and copy/paste friendly so you can get the admin app, API, and WebSocket tooling running even without a coding background.

## 1. One-time prerequisites

1. Install **Node.js 20** (the project expects version 20 or newer). The official installer is available at [nodejs.org](https://nodejs.org/en/download/).
2. Open a terminal (on macOS you can use the built-in **Terminal** app) and run:
   ```bash
   cd /Users/myadennis/Downloads/MainProject
   npm install
   ```
   This downloads all project dependencies. You only have to do this again if `package.json` changes.

## 2. Configure environment variables

1. Copy the example env file:
   ```bash
   cd /Users/myadennis/Downloads/MainProject
   cp .env.example .env.local
   ```
2. Open `.env.local` in any text editor and adjust only what you need:
   - Leave `VITE_API_BASE_URL` blank for local dev (the Vite proxy handles `/api` for you).
   - Keep `DEV_FALLBACK=true` so the server uses the built-in demo data when Supabase credentials are not present.
   - If you do have Supabase credentials, fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
   - Optional: if VPNs/firewalls block websocket hot reloading, tweak `VITE_HMR_HOST`, `VITE_HMR_CLIENT_PORT`, or `VITE_HMR_PROTOCOL` (defaults already work for localhost).

## 3. Start everything with one command

Use the new helper script to launch both the API server (port 8888) and the Vite dev server (port 5174):
```bash
cd /Users/myadennis/Downloads/MainProject
npm run dev:full
```
- Wait until you see log lines mentioning both servers ("Using port 8888" and "VITE vX.X.X ready in ...").
- Keep this terminal window open; it keeps both processes running.

If you ever prefer manual control, open two terminals:
1. Terminal A: `npm run start:server`
2. Terminal B: `npm run dev`

## 4. Open the app

Browse to [http://localhost:5174](http://localhost:5174). The Vite dev server proxies `/api` calls automatically to the Express server running on port 8888, so no extra configuration is required.

## 5. Health checks & troubleshooting

- To verify the API, open another terminal and run:
  ```bash
  curl http://localhost:8888/api/health
  ```
  You should see a JSON object with `"status":"ok"` and `"supabase":{"status":"disabled"}` when running in demo mode.
- If hot reloading ever stops working, quit the dev command (`Ctrl+C`) and run `npm run dev:full` again; the new Vite HMR settings ensure the websocket URL always matches `localhost:5174`.
- Service workers are disabled automatically in development. If you previously had an old service worker cached, the app now clears it for you when dev mode boots.

## 6. Stopping the stack

- Press `Ctrl+C` in the terminal that is running `npm run dev:full`. The script sends shutdown signals to both the API server and Vite so everything exits cleanly.

That’s it—follow the order above whenever you need to work locally. Reach out if anything in these steps is unclear or needs to be even more automated.
