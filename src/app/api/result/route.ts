import { NextRequest, NextResponse } from 'next/server';
import { getJobResult } from '@/lib/redis';
import * as fs from 'fs/promises';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      );
    }

    const result = await getJobResult(jobId);

    if (!result) {
      return NextResponse.json(
        { error: 'Job not found or not completed' },
        { status: 404 }
      );
    }

    // Read the ZIP file
    const zipBuffer = await fs.readFile(result.zipPath);

    // Return the ZIP file as a download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${jobId}-generated.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Result request error:', error);
    return NextResponse.json(
      { error: 'Failed to get job result' },
      { status: 500 }
    );
  }
}