# ⚠️ Note: CourseContentCreator.js File Issue

If you see repeated TypeScript build errors about `src/components/CourseContentCreator.js`, it is because this file is being auto-generated from `CourseContentCreator.jsx` by a tool or editor watcher. This JS file should NOT exist in the `src/components/` directory.

## How to Fix Permanently
- Only keep `CourseContentCreator.jsx` as the source file.
- Remove `CourseContentCreator.js` from `src/components/`.
- Ensure your build tools (Vite, Babel, IDE, etc.) do NOT emit `.js` files into `src/components/`.
- If using VS Code or another editor, disable "compile on save" or similar features for this folder.
- The correct output directory for compiled files is usually `dist/` or `build/`, not `src/`.

## Why This Matters
TypeScript will refuse to overwrite a `.js` file in the source tree when compiling `.tsx`/`.ts` files, causing persistent build failures.

## Quick Fix
- Delete `src/components/CourseContentCreator.js` whenever it appears.
- Add it to `.gitignore` (already done).
- Fix your build/watch config as soon as possible.

---
This note was auto-generated to help future maintainers avoid this recurring issue.
