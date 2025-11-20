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

### 4. Start Services
```bash
# Terminal 1: Start Next.js dev server
npm run dev

# Terminal 2: Start worker process
npm run worker
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

### Download Results
```bash
curl -O http://localhost:3000/api/result?jobId=uuid-here
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

### Testing

Run the demo script to test the complete flow:
```bash
bash scripts/demo.sh
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

## License

MIT
# vibetester
