# Frontend (AI Test Architect)

## Run
- Ensure backend is running (`docker-compose up -d`, `npm run dev`, `npm run worker`).
- Install deps: `npm install`.
- Build analyzer image (backend requirement): `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`.
- Start frontend (same Next app): `npm run dev`.
- Open `http://localhost:3000/`.

## Flow
1. On `/`, upload a ZIP (max 50MB) or enter a GitHub URL; click “Analyze Repo”.
2. You are redirected to `/job/<jobId>`.
3. The page polls `/api/status?jobId=...` every 2s; logs update live.
4. Once `status` is `done`, click “Refresh Result” to fetch `/api/result?jobId=...` and browse generated files.
5. Click a file to open syntax‑highlighted preview; copy or download single file.

## Notes
- No backend changes required; uses existing endpoints.
- Logs render from `status.progress` messages.
- If full content isn’t provided by backend, previews are used for modal and download.