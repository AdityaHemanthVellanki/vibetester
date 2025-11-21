import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import formidable, { Fields, Files } from 'formidable';
import * as fs from 'fs/promises';
import * as path from 'path';
import { addAnalysisJob } from '@/lib/queue';

export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '50mb',
  },
};

async function parseForm(req: NextApiRequest): Promise<{ fields: Fields; files: Files }> {
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const jobId = uuidv4();
    const tmpBase = path.join(process.cwd(), 'tmp');
    const jobTmpDir = path.join(tmpBase, jobId);
    await ensureDir(jobTmpDir);

    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const { fields, files } = await parseForm(req);
      const gitUrl = Array.isArray(fields.gitUrl) ? String(fields.gitUrl[0] || '') : String((fields.gitUrl as string) || '');
      const uploaded = files.file as formidable.File | undefined;

      if (!gitUrl && !uploaded) {
        return res.status(400).json({ error: 'Either gitUrl or file must be provided' });
      }

      if (uploaded && uploaded.filepath) {
        const dest = path.join(jobTmpDir, 'upload.zip');
        const data = await fs.readFile(uploaded.filepath);
        await fs.writeFile(dest, data);
        await addAnalysisJob({ jobId, type: 'zip', uploadPath: dest });
        return res.status(200).json({ jobId });
      }

      await addAnalysisJob({ jobId, type: 'git', gitUrl });
      return res.status(200).json({ jobId });
    } else {
      const { gitUrl } = req.body || {};
      if (!gitUrl) return res.status(400).json({ error: 'gitUrl is required' });
      await addAnalysisJob({ jobId, type: 'git', gitUrl });
      return res.status(200).json({ jobId });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process analysis request' });
  }
}
