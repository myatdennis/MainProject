# Connect project with the Railway VS Code extension

This project already supports Railway (API + static frontend). These steps will help you connect with the Railway Visual Studio Code extension and deploy or manage environment variables.

1) Install the Railway extension in VS Code
   - Extension id: buildwithlayer.railway-integration-expert-x3o0c
   - Open the extension, click `Sign in with Railway`, and follow the OAuth flow.

2) Link to your Railway project
   - After signing in, open the Railway sidebar and choose your project (MainProject or whichever project you created for this repository).
   - If you haven't created a Railway project, click `New Project > Import from GitHub`, select `myatdennis/MainProject`, and pick the `feat/ws-client` branch or `main`.

3) Add/verify services
   - Frontend: Railway may detect this as a static Vite build; confirm it is configured to build and serve the `dist/` output.
   - Backend: Add a Node/Express service with the Start command: `npm run start:server`. This makes your WebSocket server and API run in Railway.

4) Configure environment variables
   - Click the service and open the `Variables` tab in the Railway extension.
   - Add the following env variables for the **server service** (do NOT add these to client-side env as `VITE_` prefixes unless intentionally exposed):
     - SUPABASE_URL: https://miqzywzuqzeffqpiupjm.supabase.co
     - SUPABASE_SERVICE_ROLE_KEY: <paste-service-role-here>
     - CORS_ALLOWED_ORIGINS: https://your-frontend-hostname1,https://www.yourdomain.com
     - PORT: 8888
     - DEV_FALLBACK: false
     - BROADCAST_API_KEY: <random-secret> (optional)

5) Verify build & start
   - For the API/Node service: set Start command to `npm run start:server`.
   - Confirm build logs show `Using port 8888` or `Using port ${PORT}` and the health endpoint returns 200.

6) Re-deploy
   - In the Railway extension, select `Deploy` and watch the logs for a successful start.

7) Extra: set up a static frontend
   - If you want the frontend served separately, create a `Vite static` service or host on Netlify/Vercel and set `VITE_API_BASE_URL` to your Railway API URL.

8) Tips
   - The `start:server` script runs a port-check helper in dev; Railway's container will set process.env.PORT automatically.
   - To verify the backend, run `curl -fsS https://your-railway-host/api/health` from a terminal.

If you want, I can create a sample `railway.json` with the Node service start command and a CI-friendly `railway.env.example` to document variables. Would you like me to add those artifacts to the repo automatically?