import { execFile } from 'child_process';
import * as path from 'path';

export type RunResult = { stdout: string; stderr: string; code: number };

export function runCommandUnsafe(cmd: string, args: string[], cwd?: string, timeoutMs: number = 30000): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      resolve({ stdout: String(stdout), stderr: String(stderr), code: 0 });
    });
    child.on('error', (err) => reject(err));
  });
}

export function sandboxTmpDir(jobId: string): string {
  return path.join(process.cwd(), 'tmp', jobId);
}