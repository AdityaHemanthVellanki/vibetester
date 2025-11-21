import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobResult } from '@/lib/redis';
import * as fs from 'fs/promises';
import * as path from 'path';

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

    const outDir = result.outDir;
    const files: { path: string; preview: string }[] = [];
    async function collect(dir: string, base: string) {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const full = path.join(dir, it.name);
        const rel = path.relative(base, full);
        if (it.isDirectory()) await collect(full, base);
        else {
          const buf = await fs.readFile(full);
          const text = buf.toString('utf8');
          files.push({ path: rel, preview: text.slice(0, 400) });
        }
      }
    }
    await collect(outDir, outDir);

    return res.status(200).json({ jobId, outDir, files });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get job result' });
  }
}
