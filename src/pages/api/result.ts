import type { NextApiRequest, NextApiResponse } from 'next';
import { getJobResult } from '@/lib/redis';
import { getSignedUrlForKey } from '@/lib/storage';
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
    const resultAny = await getJobResult(jobId) as any;
    if (!resultAny) return res.status(404).json({ error: 'Result not ready' });

    if (resultAny.s3Prefix) {
      const bucketName = process.env.S3_BUCKET || ''
      const keyPrefix = String(resultAny.s3Prefix).replace(`${bucketName}/`, '')
      type FileRec = { path: string; size?: number }
      const files = await Promise.all((resultAny.files || []).map(async (f: string | FileRec) => {
        const p = typeof f === 'string' ? f : f.path
        const sz = typeof f === 'string' ? undefined : f.size
        const url = await getSignedUrlForKey(`${keyPrefix}${p}`)
        return { path: p, size: sz, signedUrl: url }
      }))
      return res.status(200).json({ jobId, s3Prefix: resultAny.s3Prefix, files });
    }

    const outDir = String(resultAny.outDir || '')
    const files: { path: string; preview: string }[] = []
    async function collect(dir: string, base: string) {
      const items = await fs.readdir(dir, { withFileTypes: true })
      for (const it of items) {
        const full = path.join(dir, it.name)
        const rel = path.relative(base, full)
        if (it.isDirectory()) await collect(full, base)
        else {
          const buf = await fs.readFile(full)
          const text = buf.toString('utf8')
          files.push({ path: rel, preview: text.slice(0, 400) })
        }
      }
    }
    await collect(outDir, outDir)

    return res.status(200).json({ jobId, outDir, files });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to get job result'
    const isRedis = msg.includes('ECONNREFUSED') || msg.includes('Redis')
    return res.status(isRedis ? 503 : 500).json({ error: isRedis ? 'Redis unavailable' : msg })
  }
}
