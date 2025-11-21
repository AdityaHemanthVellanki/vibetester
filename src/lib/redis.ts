import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl);

export interface JobProgress {
  stage: string;
  timestamp: number;
}

export interface JobResult {
  zipPath: string;
  fileCount: number;
  testFiles: string[];
}

export async function setLatestStage(jobId: string, stage: string): Promise<void> {
  await redis.set(`job:${jobId}:progress`, stage);
}

export async function appendProgressLog(jobId: string, stage: string): Promise<void> {
  const key = `job:${jobId}:progress_log`;
  const existing = await redis.get(key);
  const arr: JobProgress[] = existing ? JSON.parse(existing) : [];
  arr.push({ stage, timestamp: Date.now() });
  await redis.set(key, JSON.stringify(arr));
}

export async function getProgressLog(jobId: string): Promise<JobProgress[]> {
  const existing = await redis.get(`job:${jobId}:progress_log`);
  return existing ? JSON.parse(existing) : [];
}

export async function setJobResult(jobId: string, result: JobResult): Promise<void> {
  await redis.setex(`job:${jobId}:result`, 3600, JSON.stringify(result)); // 1 hour TTL
}

export async function getJobResult(jobId: string): Promise<JobResult | null> {
  const resultData = await redis.get(`job:${jobId}:result`);
  return resultData ? JSON.parse(resultData) : null;
}

export async function setJobError(jobId: string, error: string): Promise<void> {
  await redis.setex(`job:${jobId}:error`, 3600, error); // 1 hour TTL
}

export async function getJobError(jobId: string): Promise<string | null> {
  return await redis.get(`job:${jobId}:error`);
}

export async function getJobStatus(jobId: string): Promise<{
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: JobProgress[];
  result?: JobResult;
  error?: string;
}> {
  const progress = await getProgressLog(jobId);
  const result = await getJobResult(jobId);
  const error = await getJobError(jobId);

  let status: 'queued' | 'processing' | 'done' | 'failed' = 'queued';
  if (error) status = 'failed';
  else if (result) status = 'done';
  else if (progress.length > 0) status = 'processing';

  return { status, progress, result: result || undefined, error: error || undefined };
}
