## Overview
- Extend the backend to run all repo analysis inside a per‑job Docker container with resource limits and no ZIP output.
- Keep the current Next.js pages API routes and BullMQ queue; update worker to orchestrate the container lifecycle.
- Analyzer logic runs inside the container and writes tests into `/out`, mounted to `tmp/<jobId>/out` on the host.
- Progress logs and status use Redis with a latest stage and a timestamped progress_log. Result returns the `outDir` and generated files; no zipping or repo pushes.

## Files to Add/Update
### New Sandbox Files
- `sandbox/Dockerfile.analyzer`
  - Base: `node:20-alpine`
  - Install minimal deps: `ts-morph`, `adm-zip`, `fs-extra`, `typescript`, `openai`
  - Copy `analyzer-entry.ts` and `run-analyzer.sh` to `/app/`
  - `ENTRYPOINT ["node", "/app/analyzer-entry.ts"]`
- `sandbox/run-analyzer.sh`
  - Thin wrapper to invoke `node /app/analyzer-entry.ts` and forward signals (SIGTERM/SIGINT) properly.
- `sandbox/analyzer-entry.ts`
  - Reads env: `REPO_DIR=/repo`, `OUT_DIR=/out`, `JOB_ID`, `OPENAI_API_KEY`, optional `LLM_MODEL`
  - Scans `/repo` using ts‑morph, selects top 4 files by exports, builds exact prompt template, calls LLM, writes tests to `/out/__tests__/...`
  - Logs human-readable progress messages to stdout (e.g., `scanning`, `generating: <file>`, `done`) so worker can stream and persist.
  - Exits `0` on success, non-zero on failure.

### Worker & Lib Updates
- `worker/index.ts`
  - Implement exact stage flow:
    1. Set `job:<jobId>:progress = "started"` and append to `progress_log`.
    2. Create `tmp/<jobId>/repo` and `tmp/<jobId>/out`.
    3. If `type === "git"`: `git clone --depth 1 <gitUrl> tmp/<jobId>/repo` → stages `cloning`, `cloned`.
    4. If `type === "zip"`: move/extract into `tmp/<jobId>/repo` → stages `extracting`, `extracted`.
    5. Ensure/built analyzer image via `buildSandboxImage()`.
    6. Run container:
       ```
       docker run --rm \
         --network none \
         --memory="512m" \
         --cpus="1.0" \
         -v <abs tmp>/<jobId>/repo:/repo:ro \
         -v <abs tmp>/<jobId>/out:/out \
         -e OPENAI_API_KEY=$OPENAI_API_KEY \
         -e JOB_ID=<jobId> \
         -e LLM_MODEL=${LLM_MODEL:-gpt-4o-mini} \
         --name analyzer-<jobId> analyzer-image
       ```
    7. Stream stdout/stderr line-by-line, append `{ ts, message }` to `job:<jobId>:progress_log` and set `job:<jobId>:progress` to the latest stage.
    8. Await container exit; on non-zero exit → set `failed` and `job:<jobId>:error`.
    9. On zero exit → set `done` and `job:<jobId>:result = { outDir, files }` (list files under `/out`).
    10. Enforce 10-minute timeout via `Promise.race`; kill the container on timeout and mark failed.
  - Clean up container on completion/failure.
- `src/lib/sandbox.ts`
  - `buildSandboxImage()`: run `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .` (idempotent).
  - `runSandbox(jobId, repoDir, outDir, env)`: spawn `docker run` process; stream logs; return exit code.
  - `cleanupSandbox(jobId)`: stop/remove `analyzer-<jobId>` if still running.
- `src/lib/analyzer.ts`
  - Refactor: expose pure functions used by `analyzer-entry.ts`:
    - `analyzeRepository(repoPath): AnalysisResult` (select top 4 by exports)
    - `buildPrompt(file: AnalyzedFile)`: exact template provided
- `src/lib/llm.ts`
  - Ensure env model `LLM_MODEL` with default `gpt-4o-mini`; chat completions `/v1/chat/completions` with system role: "You are an assistant that writes production‑grade Jest tests.", `temperature: 0.0`, `max_tokens: 1400`.

### API Routes (No ZIP)
- `src/pages/api/analyze.ts`
  - Accept `multipart/form-data` (`file`) or JSON `{ gitUrl }`; enqueue with type `zip|git`; enforce 50MB limit.
- `src/pages/api/status.ts`
  - Return `{ jobId, status: 'queued'|'processing'|'done'|'failed', progress: [...], result?, error? }` where `progress` is the array of human-readable messages from `progress_log`.
- `src/pages/api/result.ts`
  - If job done, read under `tmp/<jobId>/out` and return `{ jobId, outDir, files: [{ path, preview }] }`. Preview limited to first 400 chars.

### Scripts & Docs
- `scripts/demo.sh`
  - Default repo arg `https://github.com/rauchg/nextjs-blog-starter`.
  - POST analyze → print `jobId`.
  - Poll status every 3s until `done` or `failed`.
  - On `done`, GET result, print JSON listing, and save first file preview to `tmp/demo-<jobId>-first-preview.txt`.
- `.env.example`
  - `REDIS_URL`, `OPENAI_API_KEY`, `LLM_MODEL`.
- `README.md`
  - Add Sandboxing & Security section: explains container isolation, `--network none`, resource limits, read-only repo mount, `/out` mount.
  - Prereqs: Docker required.
  - Build command:
    - `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .`
  - Bold warnings: **DO NOT** expose publicly without hardening.
- `PRODUCTION_NOTES.md`
  - Production-hardening items and top next security items: microVM isolation (Firecracker/gVisor), strict egress rules, per-job ephemeral credentials & secrets sanitization.

## Redis Keys & Status Mapping
- `job:<jobId>:progress` → latest stage string (`cloning`, `generating: fileX`, `done`).
- `job:<jobId>:progress_log` → JSON array of `{ ts, message }` (append-only).
- `job:<jobId>:result` → `{ outDir: <abs>, files: [...] }` when success.
- `job:<jobId>:error` → message when failure.
- `GET /api/status` builds `status` from presence of error/result/progress_log length.

## Validation Plan
1. `docker-compose up -d` starts Redis.
2. `docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .` succeeds.
3. `npm run dev` and `npm run worker` start.
4. Submit `POST /api/analyze` with a small TS repo.
5. Observe worker spawning container and streaming logs.
6. `GET /api/status` shows stages and `done`.
7. `GET /api/result` returns `outDir` and generated tests with previews.

## Notes & Assumptions
- The worker runs on the host and requires Docker installed.
- No ZIP creation or git pushes; agent-only output written into `tmp/<jobId>/out/`.
- Analyzer container is minimal and stateless; host passes env vars only needed for LLM.

Please confirm, and I will implement the changes and generate all files in the workspace accordingly.