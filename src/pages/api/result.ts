import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobResult } from '@/lib/redis';
import { getSignedUrlForKey } from '@/lib/storage';
import { config } from '@/lib/env'
import * as fs from 'fs/promises';
import { initSentry } from '@/lib/sentry';
import * as path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initSentry()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId is required' });

  try {
    const resultAny = await getJobResult(jobId) as any;
    if (!resultAny) return res.status(404).json({ error: 'Result not ready' });

    // If job result is backed by R2/S3, return { jobId, s3Prefix, files: [{ path, size, signedUrl }] }
    if (resultAny.s3Prefix) {
      const bucketName = config.r2.bucket
      const keyPrefix = resultAny.s3Prefix.replace(`${bucketName}/`, '')
      type FileRec = { path: string; size?: number }
      const files = await Promise.all((resultAny.files || []).map(async (f: string | FileRec) => {
        const p = typeof f === 'string' ? f : f.path
        const sz = typeof f === 'string' ? undefined : f.size
        const url = await getSignedUrlForKey(`${keyPrefix}${p}`)
        return { path: p, size: sz, signedUrl: url }
      }))
      return res.status(200).json({ jobId, s3Prefix: resultAny.s3Prefix, files });
    }

    const outDir = (resultAny.outDir as string) || '';
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to get job result';
    const isRedis = msg.includes('ECONNREFUSED') || msg.includes('Redis');
    return res.status(isRedis ? 503 : 500).json({ error: isRedis ? 'Redis unavailable' : msg });
  }
}
