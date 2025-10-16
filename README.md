# LMSWebsite

This project is a Vite-powered React + TypeScript application for managing LMS (Learning Management System) features.

## Update your local repository

1. Ensure you are on the main branch with the latest changes:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a feature branch for your work:
   ```bash
   git checkout -b feature/my-update
   ```
3. Install dependencies if you have not already:
   ```bash
   npm install
   ```
4. Make your code changes. Run checks locally when relevant:
   ```bash
   npm run lint
   npm test
   ```
5. Stage, commit, and push your updates to GitHub:
   ```bash
   git add .
   git commit -m "Describe your change"
   git push origin feature/my-update
   ```
6. Open a pull request on GitHub to review and merge your branch into `main`.

## Preview your changes locally

Vite provides a fast development server that lets you preview updates before pushing them.

- Start the dev server for instant feedback with hot reloading:
  ```bash
  npm run dev
  ```
  Visit the printed localhost URL (default `http://localhost:5173`) in your browser to see the live preview.

- To inspect the production build locally, run:
  ```bash
  npm run build
  npm run preview
  ```
  This compiles the project and serves the optimized build at `http://localhost:4173`.

Stop the server with `Ctrl + C` when you are finished.

## Preview changes on GitHub

After pushing your branch, open a pull request. GitHub will show the diff so you can review exactly what will change. You can also enable GitHub Pages or use a deployment preview service (such as Vercel or Netlify) if you want to share a live link for reviewers.

## Additional scripts

Commonly used scripts are defined in `package.json`:

- `npm run dev` – start the Vite development server.
- `npm run build` – create an optimized production build.
- `npm run preview` – serve the production build locally.
- `npm run lint` – run the ESLint code quality checks.
- `npm test` – execute the Vitest test suite.

Refer to the source code and scripts in the repository for more advanced workflows.
