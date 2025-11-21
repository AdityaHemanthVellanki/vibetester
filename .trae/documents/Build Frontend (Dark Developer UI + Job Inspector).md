## Overview
- Implement a dark-themed Next.js frontend that uploads repos (ZIP or Git URL), enqueues jobs, polls status every 2s, streams logs via progress array, and renders generated test files with syntax‑highlighted previews. 
- Use pages router under `src/pages` to match existing API layout, keep TypeScript throughout, and do not modify backend behavior or endpoints.

## File Structure to Create
- `src/pages/index.tsx` (landing + upload)
- `src/pages/job/[jobId].tsx` (job inspector)
- `src/components/UploadRepo.tsx` (ZIP/Git URL form)
- `src/components/StatusPoller.tsx` (polls `/api/status` every 2s)
- `src/components/LogViewer.tsx` (shows progress messages, auto‑scroll)
- `src/components/FileList.tsx` (lists files from result, shows short preview)
- `src/components/CodePreviewModal.tsx` (syntax‑highlighted code preview, copy, download)
- `src/styles/globals.css` (Tailwind base, dark theme tokens)
- `tailwind.config.js` (dark theme config)
- `postcss.config.js` (Tailwind/PostCSS setup)
- `package.json` (add `tailwindcss`, `postcss`, `autoprefixer`, `react-syntax-highlighter`, `swr`)
- `README_FRONTEND.md` (how to run frontend and test)

## Styling & Theming
- Dark background `#0b1020`, panels `#0f1724`, accents `#7c3aed` or `#6366f1`.
- Monospace font for code (JetBrains Mono or system fallback).
- Responsive layouts: single column mobile; two-column desktop (left: logs/timeline; right: files/preview).
- Micro‑animations: subtle hover states and fade‑in.

## Component Behaviors
- `UploadRepo.tsx`
  - Inputs: file (ZIP, max 50MB) or `gitUrl` string.
  - Submit via `FormData` to `POST /api/analyze`.
  - On `{ jobId }`, redirect to `/job/<jobId>`.
  - Client‑side validation for size and basic URL pattern.
- `StatusPoller.tsx`
  - Props: `jobId`, optional callbacks.
  - Polls `GET /api/status?jobId=<id>` every 2s.
  - Exposes `{ status, progress, result, error }` to parent.
- `LogViewer.tsx`
  - Displays `progress` messages as a live log (timestamp optional if present; if not, render lines with monotonic index).
  - Auto‑scroll toggle; copy to clipboard; clear view.
- `FileList.tsx`
  - Renders `result.files[]` items with `path` and first 120 chars preview.
  - Clicking opens `CodePreviewModal`.
- `CodePreviewModal.tsx`
  - Uses `react-syntax-highlighter` to render preview text.
  - Buttons: copy, download single file (create blob from preview or content if present).

## Pages
- `src/pages/index.tsx`
  - Hero with short intro and `UploadRepo` component.
  - CTA “Analyze Repo”.
  - Import `src/styles/globals.css` for Tailwind.
- `src/pages/job/[jobId].tsx`
  - Header: jobId and status badge (queued/processing/done/failed).
  - Uses `StatusPoller` to fetch status.
  - Live timeline from `status.progress` array; spinner while processing.
  - `LogViewer` renders live messages (from `progress` array as surrogate log entries).
  - “Refresh Result” button calls `GET /api/result?jobId=...` to render files.
  - If `result` exists, render `FileList`; open `CodePreviewModal` on click.
  - If failed, show error and “Retry” (re‑submit saved `gitUrl` or allow re‑upload).
- `src/pages/result/[jobId].tsx` (optional, mirrors job inspector’s result section to directly fetch result JSON and render files).

## API Integration
- Analyze: `POST /api/analyze` → `{ jobId }`.
- Status: `GET /api/status?jobId=<id>` → `{ jobId, status, progress: [...], result?, error? }`.
- Result: `GET /api/result?jobId=<id>` → `{ outDir, files: [{ path, preview }] }`.
- If full file content isn’t provided, use preview; provide “Fetch full file” button that re‑requests `GET /api/result?jobId=`.

## Tailwind Setup
- Add `tailwindcss`, `postcss`, `autoprefixer`.
- `tailwind.config.js` scans `src/pages/**/*` and `src/components/**/*`.
- `postcss.config.js` with Tailwind and Autoprefixer.
- Import `globals.css` in `src/pages/index.tsx` and `src/pages/job/[jobId].tsx` (avoid `_app.tsx` to keep to exact file list).

## Accessibility
- Keyboard accessible modals (ESC to close, focus trap).
- Buttons/inputs with `aria-labels`.
- Loading skeletons while polling; clear “failed” state handling.

## README_FRONTEND.md
- Instructions:
  - Ensure backend worker and Redis are running.
  - `npm install` (frontend deps now included in root app).
  - `npm run dev` to start.
  - Open `/`, upload or enter Git URL, follow redirect to `/job/<jobId>`.

## Validation Steps
1. Start backend/worker (already built).
2. Run `npm run dev` for frontend.
3. Visit `/` → upload ZIP or enter GitHub URL → submit → redirected to `/job/<jobId>`.
4. Observe status progress and logs; on `done` see `__tests__/*.test.ts` in files list.
5. Open modal for syntax highlighted preview; copy/download works.
6. On failure, error message and retry button present.

## Notes & Constraints
- No backend changes; use existing endpoints exactly.
- Logs rely on `status.progress` (if backend doesn’t include a separate `progress_log`).
- Download uses available preview; if full content is needed later, rely on repeated `GET /api/result` calls.

If approved, I will implement these files exactly and wire up the frontend without touching backend behavior.