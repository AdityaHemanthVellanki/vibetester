import { Worker } from 'bullmq';
import { ANALYSIS_QUEUE_NAME, redisConnection, AnalysisJob } from '../src/lib/queue';
import { setLatestStage, appendProgressLog, setJobResult, setJobError } from '../src/lib/redis';
import { uploadOutDir } from '../src/lib/storage';
import { buildSandboxImage, runSandbox, cleanupSandbox } from '../src/lib/sandbox';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';

const TMP_DIR = path.join(process.cwd(), 'tmp');

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function processAnalysisJob(job: AnalysisJob): Promise<void> {
  const { jobId, gitUrl, uploadPath, type } = job;
  
  console.log(`Processing job ${jobId}...`);

  try {
    const jobDir = path.join(TMP_DIR, jobId);
    await ensureDir(jobDir);

    let repoPath: string;

    await setLatestStage(jobId, 'started');
    await appendProgressLog(jobId, 'started');

    if (type === 'git' && gitUrl) {
      await setLatestStage(jobId, 'cloning');
      await appendProgressLog(jobId, 'cloning');
      repoPath = path.join(jobDir, 'repo');
      
      try {
        execSync(`git clone --depth 1 ${gitUrl} ${repoPath}`, { 
          stdio: 'pipe',
          timeout: 30000, // 30 second timeout
        });
      } catch (error) {
        throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await setLatestStage(jobId, 'cloned');
      await appendProgressLog(jobId, 'cloned');
    } else if (type === 'zip' && uploadPath) {
      await setLatestStage(jobId, 'extracting');
      await appendProgressLog(jobId, 'extracting');
      repoPath = path.join(jobDir, 'repo');
      await ensureDir(repoPath);
      
      try {
        const zip = new AdmZip(uploadPath);
        zip.extractAllTo(repoPath, true);
      } catch (error) {
        throw new Error(`Failed to extract ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await setLatestStage(jobId, 'extracted');
      await appendProgressLog(jobId, 'extracted');
    } else {
      throw new Error('Invalid job type or missing parameters');
    }

    const outDir = path.join(TMP_DIR, jobId, 'out');
    await ensureDir(outDir);

    await buildSandboxImage();

    await setLatestStage(jobId, 'scanning');
    await appendProgressLog(jobId, 'scanning');

    const exitCode = await runSandbox({
      jobId,
      repoDir: repoPath,
      outDir,
      env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY, LLM_MODEL: process.env.LLM_MODEL },
      onLog: async (line) => {
        await setLatestStage(jobId, line);
        await appendProgressLog(jobId, line);
      }
    });

    if (exitCode !== 0) {
      throw new Error(`Analyzer container exited with code ${exitCode}`);
    }

    const files: string[] = [];
    async function collect(dir: string) {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const it of items) {
        const full = path.join(dir, it.name);
        if (it.isDirectory()) await collect(full);
        else files.push(path.relative(outDir, full));
      }
    }
    await collect(outDir);

    const useS3 = process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY;
    if (useS3) {
      const uploaded = await uploadOutDir(jobId, outDir);
      await setJobResult(jobId, { s3Prefix: uploaded.s3Prefix, files: uploaded.files.map(f => f.path) });
    } else {
      await setJobResult(jobId, { outDir, files });
    }

    await setLatestStage(jobId, 'done');
    await appendProgressLog(jobId, 'done');

    console.log(`Job ${jobId} completed successfully. Generated ${files.length} test files.`);
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await setJobError(jobId, errorMessage);
    await setLatestStage(jobId, 'failed');
    await appendProgressLog(jobId, 'failed');
    await cleanupSandbox(jobId);
    throw error;
  }
}

const worker = new Worker(ANALYSIS_QUEUE_NAME, async (job) => {
  const analysisJob = job.data as AnalysisJob;
  const tenMinutes = 10 * 60 * 1000;
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => reject(new Error('Job timed out after 10 minutes')), tenMinutes);
  });
  await Promise.race([processAnalysisJob(analysisJob), timeoutPromise]).catch(async (e) => {
    await setJobError(analysisJob.jobId, e instanceof Error ? e.message : 'Timeout');
    await setLatestStage(analysisJob.jobId, 'failed');
    await appendProgressLog(analysisJob.jobId, 'failed');
    throw e;
  });
}, {
  connection: redisConnection,
  concurrency: 1, // Process one job at a time for resource management
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

console.log('Worker started and listening for jobs...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});