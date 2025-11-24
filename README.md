# AI Test Architect Backend

**⚠️ SECURITY WARNING: This system runs user code — DO NOT deploy publicly until you add container-based sandboxing. The current MVP runs analysis in-process for speed and prototyping only.**

A TypeScript backend that accepts a repository (zip or GitHub URL), enqueues a job, runs static analysis to extract exported functions, calls an LLM to generate Jest test stubs, bundles results into a ZIP, and exposes status + download endpoints.

## Tech Stack

- **Node.js + TypeScript**
- **Next.js** for public API routes (server-side only)
- **BullMQ** for job queue management
- **Redis** for queue and short-term job metadata
- **ts-morph** for TypeScript AST analysis
- **OpenAI** for test generation (server-side calls only)
- **adm-zip** for ZIP file creation
- **Local filesystem** storage (tmp/) for MVP

## Architecture

1. **Next.js API Routes**:
   - `POST /api/analyze` - Accepts multipart form (zip) or gitUrl field; enqueues job and returns { jobId }
   - `GET /api/status?jobId=` - Returns { jobId, status, progressLog[] }
   - `GET /api/result?jobId=` - Returns downloadable ZIP when job done

2. **Redis + BullMQ Job Queue**

3. **Worker Process** (`worker/index.ts`):
   - Pulls job, clones or extracts repo into isolated tmp dir
   - Runs ts-morph analysis to find exported symbols
   - Selects top files by exports count
   - Calls LLM to generate Jest test code
   - Writes tests under __tests__ directory
   - Zips results and updates Redis

## Quick Start

### 1. Start Redis
```bash
docker-compose up -d
docker exec -it ai-test-architect-redis redis-cli ping
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

#### Hosting REDIS_URL
- Vercel: add `REDIS_URL` (e.g., `redis://:PASSWORD@HOST:PORT`) in Project → Settings → Environment Variables.
- Render: add `REDIS_URL` in Service Environment.
- Fly.io: set `REDIS_URL` via secrets: `fly secrets set REDIS_URL=redis://...`.

### 4. Start Services
```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start worker process
npm run worker
```

### Cloudflare R2 Connectivity Test
```bash
node scripts/test_r2_connection.js
```

## API Usage

### Submit Analysis Job

**Via Git URL:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "gitUrl=https://github.com/user/repo"
```

**Via ZIP Upload:**
```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@path/to/repo.zip"
```

Response:
```json
{ "jobId": "uuid-here" }
```

### Check Job Status
```bash
curl http://localhost:3000/api/status?jobId=uuid-here
```

Response:
```json
{
  "status": "processing",
  "progress": [
    {
      "stage": "cloning",
      "message": "Cloning repository from https://github.com/user/repo",
      "timestamp": 1234567890
    }
  ]
}
```

### Fetch Results JSON
```bash
curl http://localhost:3000/api/result?jobId=uuid-here
```
Response:
```json
{
  "jobId": "...",
  "s3Prefix": "bucketName/jobId/out/",
  "files": [
    { "path": "__tests__/a.test.ts", "size": 1234, "signedUrl": "https://..." }
  ]
}
```

## Environment Variables

- `REDIS_URL` - Redis connection URL (default: redis://localhost:6379)
- `OPENAI_API_KEY` - Your OpenAI API key
- `LLM_MODEL` - OpenAI model to use (default: gpt-4o-mini)
- `NODE_ENV` - Node environment (development/production)

## Security Considerations

⚠️ **IMPORTANT SECURITY NOTES:**

1. **Code Execution**: This system runs user-provided code analysis. DO NOT deploy publicly without proper sandboxing.

2. **Resource Limits**: The MVP includes basic limits:
   - Max upload size: 50MB
   - Git clone timeout: 30 seconds
   - Processes one job at a time

3. **Environment Isolation**: Clear environment before running user code; don't mount secret envs into worker runtime.

4. **Rate Limiting**: Consider adding rate limiting for production use.

## Development

### Project Structure
```
src/
├── app/
│   └── api/
│       ├── analyze/route.ts    # Job submission endpoint
│       ├── status/route.ts     # Job status endpoint
│       └── result/route.ts     # Result download endpoint
├── lib/
│   ├── queue.ts              # BullMQ configuration
│   ├── redis.ts              # Redis utilities
│   ├── analyzer.ts           # ts-morph analyzer
│   └── llm.ts                # OpenAI wrapper
└── worker/
    └── index.ts              # Job processing worker
```

### Sandboxing & Security

- Analysis runs inside Docker containers with `--network none` and resource limits.
- Repo mounted read-only to `/repo` and output mounted to `/out`.
- Host does not execute untrusted code directly; Docker required.
- Build analyzer image:
```
docker build -f sandbox/Dockerfile.analyzer -t analyzer-image .
```
- **DO NOT** expose this service publicly without additional hardening.
- Top next security items:
  1. MicroVM isolation (Firecracker/gVisor)
  2. Strict network & filesystem egress rules
  3. Per-job ephemeral credentials & secrets sanitization

### Full-Stack Testing

Run the demo script to test the complete flow:
```bash
bash scripts/demo.sh <gitUrl>
```

Or enqueue with API key:
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "x-api-key: <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"gitUrl":"https://github.com/owner/repo"}'
```

Or manually test with a sample repository:
```bash
# Submit a job
curl -X POST http://localhost:3000/api/analyze \
  -F "gitUrl=https://github.com/octokit/rest.js"

# Poll status until completed
curl http://localhost:3000/api/status?jobId=YOUR_JOB_ID

# Download results when completed
curl -O http://localhost:3000/api/result?jobId=YOUR_JOB_ID
```

### Monitoring

- Worker logs show job processing stages
- Redis keys track progress: `job:{jobId}:progress`
- Job results stored at: `job:{jobId}:result`
- Errors stored at: `job:{jobId}:error`

## Production Deployment

Before deploying to production:

1. **Add Container Sandboxing**: Use Docker containers or similar to isolate user code execution
2. **Implement Rate Limiting**: Add request rate limiting
3. **Use Object Storage**: Replace local filesystem with S3 or similar for result storage
4. **Add Authentication**: Implement API authentication
5. **Set Up Monitoring**: Add application monitoring and alerting
6. **Configure Resource Limits**: Set appropriate CPU/memory limits

## Cloudflare R2 Object Storage

Use Cloudflare R2 to store job outputs and serve signed URLs.

Steps:
- Cloudflare dashboard → R2 → Create bucket.
- R2 → Access keys → Create key (Access Key ID + Secret).
- Copy bucket endpoint or account id, set `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

Example `.env` snippet for R2:
```
S3_PROVIDER=cloudflare
S3_BUCKET=your-r2-bucket-name
S3_REGION=auto
S3_ACCESS_KEY_ID=changeme-r2-access-key
S3_SECRET_ACCESS_KEY=changeme-r2-secret
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_FORCE_PATH_STYLE=true
```

Notes:
- R2 is S3-compatible and works with AWS SDK v3 presigned URLs.
- If planning browser direct downloads, configure CORS in the R2 bucket settings to allow GET from your domain.

## License

MIT
# Acceptance Criteria

- Start Redis + Next + worker locally
- POST `/api/analyze` with `gitUrl` returns `{ jobId }`
- Poll GET `/api/status?jobId=...` shows progress stages and eventually `done`
- GET `/api/result?jobId=...` downloads a zip containing `__tests__` and at least one `.test.ts`
- Worker logs show LLM calls, selected files, and zip path

# Node Demo Alternative

```bash
npm run enqueue:node -- https://github.com/rauchg/nextjs-blog-starter
```

# Monitoring

- Redis keys: `job:{jobId}:progress`, `job:{jobId}:progress_log`, `job:{jobId}:result`, `job:{jobId}:error`
# vibetester
