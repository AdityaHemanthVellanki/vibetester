import { Queue } from 'bullmq';
import { getBullConnection } from '@/lib/redis';

export const ANALYSIS_QUEUE_NAME = 'repo-analysis';

export interface AnalysisJob {
  jobId: string;
  gitUrl?: string;
  gitToken?: string;
  uploadPath?: string;
  type: 'git' | 'zip';
}

let analysisQueue: Queue<AnalysisJob> | null = null;
function getAnalysisQueue(): Queue<AnalysisJob> {
  if (!analysisQueue) {
    analysisQueue = new Queue<AnalysisJob>(ANALYSIS_QUEUE_NAME, {
      ...getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 1,
      },
    });
    // BullMQ v5 handles scheduling without explicit QueueScheduler
  }
  return analysisQueue;
}

export async function addAnalysisJob(job: AnalysisJob): Promise<string> {
  try {
    const queue = getAnalysisQueue();
    const jobData = await queue.add('analyze-repo', job, { jobId: job.jobId });
    return jobData.id!;
  } catch (err: any) {
    const msg = err?.code === 'ECONNREFUSED' || String(err?.message || '').includes('ECONNREFUSED')
      ? 'Redis unavailable'
      : 'Failed to enqueue job';
    throw new Error(msg);
  }
}

// Backward-compatible direct Redis client export for modules using raw operations
export const redisConnection = getBullConnection().connection as any
