import type { NextApiRequest, NextApiResponse } from 'next';
import { initSentry } from '@/lib/sentry';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import * as fs from 'fs/promises';
import * as path from 'path';
import { addAnalysisJob } from '@/lib/queue';
import { verifySession, validateApiKeyHeader } from '@/lib/auth';
import { checkRate } from '@/lib/rateLimiter';
import { insertUsage } from '@/lib/db';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
};

async function parseForm(req: NextApiRequest): Promise<{ fields: any; files: any }> {
  const form = formidable({ multiples: false, maxFileSize: 50 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  initSentry()
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const allowAnon = (process.env.ALLOW_ANON || 'true') === 'true'
    const session = verifySession(req)
    const apiKeyAuth = validateApiKeyHeader(req)
    if (!allowAnon && !session && !apiKeyAuth) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const rlKey = apiKeyAuth ? `key:${apiKeyAuth.apiKeyId}` : session ? `user:${session.id}` : `ip:${req.socket.remoteAddress}`
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || '30')
    const rl = await checkRate(rlKey, limit)
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.reset - Math.floor(Date.now()/1000)))
      return res.status(429).json({ error: 'rate limit exceeded' })
    }
    const jobId = uuidv4();
    const tmpBase = path.join(process.cwd(), 'tmp');
    const jobTmpDir = path.join(tmpBase, jobId);
    await ensureDir(jobTmpDir);

    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const { fields, files } = await parseForm(req);
      const gitUrlField = fields?.gitUrl;
      const gitUrl = Array.isArray(gitUrlField) ? String(gitUrlField[0] || '') : typeof gitUrlField === 'string' ? gitUrlField : '';
      const uploaded = files?.file;

      if (!gitUrl && !uploaded) {
        return res.status(400).json({ error: 'Either gitUrl or file must be provided' });
      }

      if (uploaded && uploaded.filepath) {
        const dest = path.join(jobTmpDir, 'upload.zip');
        const data = await fs.readFile(uploaded.filepath);
        await fs.writeFile(dest, data);
        try {
          await addAnalysisJob({ jobId, type: 'zip', uploadPath: dest });
          return res.status(200).json({ jobId });
        } catch (err: any) {
          const msg = err?.message || 'Failed to enqueue job';
          const isRedis = msg.includes('Redis unavailable') || String(err?.code || '').includes('ECONNREFUSED');
          return res.status(isRedis ? 503 : 500).json({ error: msg });
        }
      }

      try {
        await addAnalysisJob({ jobId, type: 'git', gitUrl });
        return res.status(200).json({ jobId });
      } catch (err: any) {
        const msg = err?.message || 'Failed to enqueue job';
        const isRedis = msg.includes('Redis unavailable') || String(err?.code || '').includes('ECONNREFUSED');
        return res.status(isRedis ? 503 : 500).json({ error: msg });
      }
    } else {
      const { gitUrl } = req.body || {};
      if (!gitUrl) return res.status(400).json({ error: 'gitUrl is required' });
      try {
        await addAnalysisJob({ jobId, type: 'git', gitUrl });
        return res.status(200).json({ jobId });
      } catch (err: any) {
        const msg = err?.message || 'Failed to enqueue job';
        const isRedis = msg.includes('Redis unavailable') || String(err?.code || '').includes('ECONNREFUSED');
        return res.status(isRedis ? 503 : 500).json({ error: msg });
      }
    }
    insertUsage(session ? session.id : null, apiKeyAuth ? apiKeyAuth.apiKeyId : null, '/api/analyze')
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process analysis request' });
  }
}
