## Scope
Integrate S3 end‑to‑end for local dev and production: update `.env` with commented S3 keys, implement a robust `src/lib/storage.ts` with AWS/MinIO autodetection, wire the worker to upload results and store S3 metadata in Redis, enhance `/api/result` to emit signed URLs, and add a self‑check script. Include clear developer guidance comments where appropriate.

## Files To Add/Update
- Add/update `.env` with commented S3 keys and safe placeholders
- Update `src/lib/storage.ts` to:
  - Read creds from env
  - Configure S3Client with `endpoint` and `forcePathStyle` for MinIO
  - Implement `uploadOutDir(jobId, localPath)` and `getSignedUrlForKey(key)`
  - Include top‑of‑file guidance comments
- Update `worker/index.ts` to:
  - Call `uploadOutDir(jobId, outDir)` after sandbox completes
  - Store `{ s3Prefix, files }` in Redis
  - Include short comments on credential usage and fallback behavior
- Update `src/pages/api/result.ts` to:
  - If `s3Prefix` exists, return array of `{ path, signedUrl }`
  - Keep local fallback
  - Add concise guidance comments
- Add `scripts/test_s3_connection.js`:
  - Attempts `PutObject`/`GetObject` and presigned URL
  - Logs clear instructions for AWS (IAM) and MinIO

## .env Content (with comments)
```
# S3 / Storage (fill these for AWS or MinIO)
S3_BUCKET=ai-test-architect-dev         # Your bucket name (create it in AWS S3 or MinIO)
S3_REGION=us-east-1                     # AWS region; keep any value for MinIO
S3_ACCESS_KEY_ID=changeme               # AWS: IAM Access Key; MinIO: MINIO_ROOT_USER
S3_SECRET_ACCESS_KEY=changeme           # AWS: IAM Secret; MinIO: MINIO_ROOT_PASSWORD
S3_ENDPOINT=                            # AWS: leave blank; MinIO example: http://localhost:9000
S3_FORCE_PATH_STYLE=true                # MinIO=true; AWS=false
```
(We will place these into `.env` with inline comments; other envs remain unchanged.)

## Storage Library
- Autodetect AWS vs MinIO:
  - If `S3_ENDPOINT` is set → treat as MinIO (set `endpoint`, `forcePathStyle` from env)
  - Else → AWS default
- Functions:
  - `uploadOutDir(jobId: string, localPath: string): Promise<{ s3Prefix: string; files: { path: string; size: number }[] }>`
  - `getSignedUrlForKey(key: string): Promise<string>`
- Comments at top:
  - Paste AWS/MinIO creds in `.env`
  - AWS creds come from IAM (Programmatic access)
  - MinIO creds come from container env (MINIO_ROOT_USER/MINIO_ROOT_PASSWORD)

## Worker Wiring
- After sandbox writes to `tmp/<jobId>/out`:
  - Call `uploadOutDir(jobId, outDir)`
  - Write Redis `job:<id>:result = { s3Prefix, files }`
  - Keep local dev fallback (if creds missing) and comment this behavior

## /api/result Behavior
- If Redis result has `s3Prefix`:
  - Return `[ { path, signedUrl } ]` via `getSignedUrlForKey(s3Prefix + path)`
- Else: local fallback with previews
- Add comments explaining AWS vs MinIO endpoint usage and why signed URLs are short‑lived

## S3 Test Script
- `scripts/test_s3_connection.js`:
  - Loads env, creates S3 client (endpoint/forcePathStyle aware)
  - Tries PutObject, GetObject, and a presigned URL
  - Logs success/failure with guidance:
    - If failure: update `.env` with real AWS IAM keys or MinIO root creds
    - AWS: use IAM Access Key/Secret; MinIO: use `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`

## Developer Guidance Comments
- Add short comments where requested:
  - Where to get AWS creds (IAM → Programmatic Access)
  - How to configure MinIO locally and what `S3_ENDPOINT` does
  - What `S3_FORCE_PATH_STYLE` changes
  - Why keys must be placed in `.env` (never hardcode)

## Validation
- Run `npm run build` to verify compilation
- Run `node scripts/test_s3_connection.js` to validate connectivity with current `.env`
- Trigger a job and confirm `/api/result` returns signed URLs when S3 is configured

## Non‑Goals
- No billing/Stripe additions
- No unrelated backend changes
- No frontend changes required

## Next Step
On approval, I will:
1) Update `.env` with commented S3 keys
2) Implement/adjust `src/lib/storage.ts`
3) Wire `worker/index.ts` and `/api/result` accordingly
4) Add `scripts/test_s3_connection.js`
5) Insert concise guidance comments in the changed files
