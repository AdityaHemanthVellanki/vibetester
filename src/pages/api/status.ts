import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobStatus } from '@/lib/redis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const status = await getJobStatus(jobId);
    return res.status(200).json({ jobId, ...status });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get job status' });
  }
}