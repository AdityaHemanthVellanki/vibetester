import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import * as fs from 'fs/promises';
import * as path from 'path';
import { addAnalysisJob } from '@/lib/queue';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = path.join(process.cwd(), 'tmp');

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUploadDir();
    
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const gitUrl = formData.get('gitUrl') as string;
      const file = formData.get('file') as File | null;

      if (!gitUrl && !file) {
        return NextResponse.json(
          { error: 'Either gitUrl or file must be provided' },
          { status: 400 }
        );
      }

      const jobId = uuidv4();
      let jobData;

      if (file) {
        // Handle file upload
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: 'File size exceeds 50MB limit' },
            { status: 400 }
          );
        }

        const uploadPath = path.join(UPLOAD_DIR, jobId, 'upload.zip');
        await fs.mkdir(path.dirname(uploadPath), { recursive: true });
        
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(uploadPath, buffer);

        jobData = {
          jobId,
          uploadPath,
          type: 'upload' as const,
        };
      } else {
        // Handle Git URL
        jobData = {
          jobId,
          gitUrl,
          type: 'git' as const,
        };
      }

      await addAnalysisJob(jobData);
      return NextResponse.json({ jobId });
    } else {
      // Handle JSON body
      const body = await request.json();
      const { gitUrl } = body;

      if (!gitUrl) {
        return NextResponse.json(
          { error: 'gitUrl is required' },
          { status: 400 }
        );
      }

      const jobId = uuidv4();
      const jobData = {
        jobId,
        gitUrl,
        type: 'git' as const,
      };

      await addAnalysisJob(jobData);
      return NextResponse.json({ jobId });
    }
  } catch (error) {
    console.error('Analysis request error:', error);
    return NextResponse.json(
      { error: 'Failed to process analysis request' },
      { status: 500 }
    );
  }
}