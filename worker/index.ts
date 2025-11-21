import { Worker } from 'bullmq';
import { ANALYSIS_QUEUE_NAME, redisConnection, AnalysisJob } from '../src/lib/queue';
import { TypeScriptAnalyzer } from '../src/lib/analyzer';
import { generateTestsWithLLM } from '../src/lib/llm';
import { setLatestStage, appendProgressLog, setJobResult, setJobError } from '../src/lib/redis';
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

    await setLatestStage(jobId, 'scanning');
    await appendProgressLog(jobId, 'scanning');

    const analyzer = new TypeScriptAnalyzer();
    const analysisResult = await analyzer.analyzeRepository(repoPath);

    console.log(`Found ${analysisResult.totalFiles} files, selected ${analysisResult.selectedFiles} for testing`);

    const generatedDir = path.join(TMP_DIR, `${jobId}-generated`);
    const testsDir = path.join(generatedDir, '__tests__');
    await ensureDir(testsDir);

    const testFiles: string[] = [];

    for (let i = 0; i < Math.min(4, analysisResult.files.length); i++) {
      const file = analysisResult.files[i];
      await setLatestStage(jobId, `generating: ${file.relativePath}`);
      await appendProgressLog(jobId, `generating: ${file.relativePath}`);

      try {
        const prompt = analyzer.buildPrompt(file);
        const testCode = await generateTestsWithLLM(prompt);

        // Create test file path preserving directory structure
        const testFileName = file.relativePath.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts');
        const testFilePath = path.join(testsDir, testFileName);
        
        // Ensure directory exists for nested paths
        await ensureDir(path.dirname(testFilePath));
        
        await fs.writeFile(testFilePath, testCode && testCode.trim() ? testCode : `// LLM returned no output for ${file.relativePath}`);
        testFiles.push(testFileName);
        
        console.log(`Generated tests for ${file.relativePath} -> ${testFileName}`);
      } catch (error) {
        console.error(`Failed to generate tests for ${file.relativePath}:`, error);
        
        // Create a placeholder file with error message
        const testFileName = file.relativePath.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts');
        const testFilePath = path.join(testsDir, testFileName);
        await ensureDir(path.dirname(testFilePath));
        
        await fs.writeFile(testFilePath, `// LLM returned no output for ${file.relativePath}`);
        testFiles.push(testFileName);
      }
    }

    await setLatestStage(jobId, 'zipping');
    await appendProgressLog(jobId, 'zipping');

    const zip = new AdmZip();
    zip.addLocalFolder(generatedDir);
    
    const zipPath = path.join(TMP_DIR, `${jobId}-generated.zip`);
    zip.writeZip(zipPath);

    await setJobResult(jobId, {
      zipPath,
      fileCount: testFiles.length,
      testFiles,
    });

    await setLatestStage(jobId, 'done');
    await appendProgressLog(jobId, 'done');

    console.log(`Job ${jobId} completed successfully. Generated ${testFiles.length} test files.`);
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await setJobError(jobId, errorMessage);
    await setLatestStage(jobId, 'failed');
    await appendProgressLog(jobId, 'failed');
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