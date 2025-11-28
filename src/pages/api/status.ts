import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobStatus } from '@/lib/redis';
import { initSentry } from '@/lib/sentry';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initSentry()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    res.setHeader('Pragma', 'no-cache')
    const status = await getJobStatus(jobId);
    return res.status(200).json({ jobId, ...status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to get job status';
    const isRedis = msg.includes('ECONNREFUSED') || msg.includes('Redis');
    return res.status(isRedis ? 503 : 500).json({ error: isRedis ? 'Redis unavailable' : msg });
  }
}
