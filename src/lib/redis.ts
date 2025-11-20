import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(redisUrl);

export interface JobProgress {
  stage: string;
  message: string;
  timestamp: number;
}

export interface JobResult {
  zipPath: string;
  fileCount: number;
  testFiles: string[];
}

export async function updateJobProgress(jobId: string, stage: string, message: string): Promise<void> {
  const progress: JobProgress = {
    stage,
    message,
    timestamp: Date.now(),
  };

  await redis.rpush(`job:${jobId}:progress`, JSON.stringify(progress));
}

export async function getJobProgress(jobId: string): Promise<JobProgress[]> {
  const progressData = await redis.lrange(`job:${jobId}:progress`, 0, -1);
  return progressData.map(item => JSON.parse(item));
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
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: JobProgress[];
  result?: JobResult;
  error?: string;
}> {
  const progress = await getJobProgress(jobId);
  const result = await getJobResult(jobId);
  const error = await getJobError(jobId);

  let status: 'queued' | 'processing' | 'completed' | 'failed' = 'queued';

  if (error) {
    status = 'failed';
  } else if (result) {
    status = 'completed';
  } else if (progress.length > 0) {
    status = 'processing';
  }

  return {
    status,
    progress,
    result: result || undefined,
    error: error || undefined,
  };
}