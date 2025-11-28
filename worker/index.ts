import { getWorker, ANALYSIS_QUEUE_NAME, AnalysisJob, redisConnection } from '@/lib/queue';
import { startWorkerHealth } from '@/../worker/health-check'
import { config } from '@/lib/env'
import { setLatestStage, appendProgressLog, setJobResult, setJobError, setJobStatus } from '@/lib/redis';
import { uploadOutDir } from '@/lib/storage';
import { buildSandboxImage, runSandbox, cleanupSandbox } from '@/lib/sandbox';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import { pushMetric } from '@/lib/observability';
import { sanitizeAndNormalizeGitUrl, cloneWithRetries } from '@/lib/git';
import * as Sentry from '@sentry/node'

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

    await setJobStatus(jobId, 'running');
    await setLatestStage(jobId, 'started');
    await appendProgressLog(jobId, 'started', 'started');
    try { await redisConnection.set(`job:${jobId}:startedAt`, String(Date.now())) } catch {}
    await pushMetric('jobs_started_total', { jobId }, 1);

    if (type === 'git' && gitUrl) {
      try { await redisConnection.setex(`job:${jobId}:meta`, 3600, JSON.stringify({ gitUrl })) } catch {}
      await setLatestStage(jobId, 'validating');
      await appendProgressLog(jobId, 'validating git url', 'validating');
      repoPath = path.join(jobDir, 'repo');
      const allowedHosts = ['github.com','gitlab.com','bitbucket.org']
      let normalized = ''
      try {
        normalized = sanitizeAndNormalizeGitUrl(gitUrl, (job as any).gitToken)
        const host = new URL(normalized).hostname
        if (!allowedHosts.includes(host)) {
          const msg = `git host not allowed: ${host}`
          await setJobError(jobId, msg)
          await setLatestStage(jobId, 'failed')
          await appendProgressLog(jobId, `failed: ${msg}`)
          throw new Error(msg)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await setJobError(jobId, `git url invalid: ${msg}`)
        await setLatestStage(jobId, 'failed')
        await appendProgressLog(jobId, `failed: git url invalid: ${msg}`)
        throw e
      }

      await appendProgressLog(jobId, 'cloning', 'cloning')
      await setLatestStage(jobId, 'cloning')
      try { await fs.rm(repoPath, { recursive: true, force: true }) } catch {}
      const token = (job as any).gitToken
      const cloneRes = await cloneWithRetries(normalized, repoPath, { retries: 2, timeoutMs: 30_000, scrubToken: token })
      if (!cloneRes.success) {
        const short = cloneRes.errorMessage || 'unknown error'
        const suggest = 'Check network connectivity, repo visibility, ensure HTTPS URL, or try again.'
        const fullMsg = `git clone failed: ${short}. ${suggest}`
        await setJobError(jobId, fullMsg)
        await setLatestStage(jobId, 'failed')
        await appendProgressLog(jobId, `failed: ${fullMsg}`)
        await pushMetric('job_clone_failures_total', { jobId, error_type: String(cloneRes.errorType || 'OTHER') }, 1)
        try { 
          if (process.env.SENTRY_DSN) {
            Sentry.init({ dsn: process.env.SENTRY_DSN })
            Sentry.captureException(new Error(fullMsg), { tags: { jobId, host: new URL(normalized).hostname, error_type: String(cloneRes.errorType || 'OTHER') } })
          }
        } catch {}
        if (String(short).toLowerCase().includes('401') || String(short).toLowerCase().includes('403') || String(short).toLowerCase().includes('auth')) {
          await pushMetric('job_clone_auth_failures_total', { jobId }, 1)
        }
        ;(job as any).gitToken = undefined
        throw new Error(fullMsg)
      }
      if (token) await pushMetric('job_clone_auth_attempts_total', { jobId }, 1)
      ;(job as any).gitToken = undefined
      await setLatestStage(jobId, 'cloned')
      await appendProgressLog(jobId, 'cloned', 'cloned')
    } else if (type === 'zip' && uploadPath) {
      await setLatestStage(jobId, 'extracting');
      await appendProgressLog(jobId, 'extracting', 'extracting');
      repoPath = path.join(jobDir, 'repo');
      await ensureDir(repoPath);
      
      try {
        const zip = new AdmZip(uploadPath);
        zip.extractAllTo(repoPath, true);
      } catch (error) {
        throw new Error(`Failed to extract ZIP: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      await setLatestStage(jobId, 'extracted');
      await appendProgressLog(jobId, 'extracted', 'extracted');
    } else {
      throw new Error('Invalid job type or missing parameters');
    }

    const outDir = path.join(TMP_DIR, jobId, 'out');
    await ensureDir(outDir);

    await buildSandboxImage();

    await setLatestStage(jobId, 'scanning');
    await appendProgressLog(jobId, 'scanning', 'scanning');

    const exitCode = await runSandbox({
      jobId,
      repoDir: repoPath,
      outDir,
      env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY, LLM_MODEL: process.env.LLM_MODEL },
      onLog: async (line) => {
        await setLatestStage(jobId, line);
        await appendProgressLog(jobId, line, 'generating');
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

    const credsPresent = process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_ENDPOINT;
    // If object storage credentials present, upload and store S3/R2 metadata
    if (credsPresent) {
      try {
        const uploaded = await uploadOutDir(jobId, outDir);
        await setJobResult(jobId, { s3Prefix: uploaded.s3Prefix, files: uploaded.files } as any);
      } catch (e) {
        await setJobError(jobId, e instanceof Error ? e.message : 'Upload failed');
        throw e;
      }
    } else {
      await setJobResult(jobId, { outDir, files } as any);
    }

    await setLatestStage(jobId, 'done');
    await appendProgressLog(jobId, 'done', 'done');
    await setJobStatus(jobId, 'done');
    try { await redisConnection.set(`job:${jobId}:completedAt`, String(Date.now())) } catch {}
    const sRaw = await redisConnection.get(`job:${jobId}:startedAt`).catch(() => null)
    const cRaw = await redisConnection.get(`job:${jobId}:completedAt`).catch(() => null)
    const s = sRaw ? Number(sRaw) : 0
    const c = cRaw ? Number(cRaw) : 0
    const durationMs = s && c ? (c - s) : 0
    await pushMetric('job_duration_seconds', { jobId }, durationMs / 1000);
    await pushMetric('job_processed_total', { jobId }, 1)

    console.log(`Job ${jobId} completed successfully. Generated ${files.length} test files.`);
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await setJobError(jobId, errorMessage);
    await setLatestStage(jobId, 'failed');
    await appendProgressLog(jobId, 'failed', 'failed');
    await setJobStatus(jobId, 'failed');
    await pushMetric('jobs_failed_total', { jobId }, 1);
    await cleanupSandbox(jobId);
    throw error;
  }
}

async function start() {
  // Worker will establish its own BullMQ connection; proceed

  const worker = getWorker(ANALYSIS_QUEUE_NAME, async (job) => {
    const analysisJob = job.data as AnalysisJob;
    const tenMinutes = Number(process.env.SANDBOX_TIMEOUT_MS || '600000');
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('Job timed out after 10 minutes')), tenMinutes);
    });
    await Promise.race([processAnalysisJob(analysisJob), timeoutPromise]).catch(async (e) => {
      await setJobError(analysisJob.jobId, e instanceof Error ? e.message : 'Timeout');
      await setLatestStage(analysisJob.jobId, 'failed');
      await appendProgressLog(analysisJob.jobId, 'failed');
      throw e;
    });
  }, { concurrency: 1 });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  console.log('Worker started and listening for jobs...');
  const stop = startWorkerHealth(`worker-${process.pid}`)

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await worker.close();
    stop()
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await worker.close();
    stop()
    process.exit(0);
  });
}

start()
