import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobResult } from '@/lib/redis';
import * as fs from 'fs/promises';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const result = await getJobResult(jobId);
    if (!result) return res.status(404).json({ error: 'Result not ready' });

    const buffer = await fs.readFile(result.zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${jobId}-generated.zip"`);
    res.setHeader('Content-Length', buffer.length.toString());
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get job result' });
  }
}