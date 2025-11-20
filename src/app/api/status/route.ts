import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus } from '@/lib/redis';

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

    const status = await getJobStatus(jobId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Status request error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}