import { Queue, Worker, JobsOptions, Processor } from 'bullmq';
import { getBullConnection } from '@/lib/redis';

export const ANALYSIS_QUEUE_NAME = 'analyze';

export interface AnalysisJob {
  jobId: string;
  gitUrl?: string;
  gitToken?: string;
  uploadPath?: string;
  type: 'git' | 'zip';
}

let sharedQueue: Queue<AnalysisJob> | null = null;
export function getQueue(name: string = ANALYSIS_QUEUE_NAME): Queue<AnalysisJob> {
  if (!sharedQueue) {
    sharedQueue = new Queue<AnalysisJob>(name, {
      ...getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return sharedQueue;
}

let sharedWorker: Worker<AnalysisJob> | null = null;
export function getWorker(name: string = ANALYSIS_QUEUE_NAME, processor: Processor<AnalysisJob>, opts?: { concurrency?: number }): Worker<AnalysisJob> {
  if (!sharedWorker) {
    sharedWorker = new Worker<AnalysisJob>(name, processor, {
      ...getBullConnection(),
      concurrency: opts?.concurrency ?? 1,
    });
  }
  return sharedWorker;
}

export async function addAnalysisJob(job: AnalysisJob): Promise<string> {
  try {
    const queue = getQueue();
    const jobData = await queue.add('analyze', job, { jobId: job.jobId } as JobsOptions);
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
