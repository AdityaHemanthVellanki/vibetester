import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new IORedis(redisUrl);

export const ANALYSIS_QUEUE_NAME = 'repo-analysis';

export interface AnalysisJob {
  jobId: string;
  gitUrl?: string;
  uploadPath?: string;
  type: 'git' | 'upload';
}

export const analysisQueue = new Queue<AnalysisJob>(ANALYSIS_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 1,
  },
});

export async function addAnalysisJob(job: AnalysisJob): Promise<string> {
  const jobData = await analysisQueue.add('analyze-repo', job, {
    jobId: job.jobId,
  });
  return jobData.id!;
}