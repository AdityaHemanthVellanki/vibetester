import { spawn } from 'child_process'
import * as path from 'path'

export async function buildSandboxImage(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('docker', ['build', '-f', 'sandbox/Dockerfile.analyzer', '-t', 'analyzer-image', '.'], { stdio: 'inherit' })
    proc.on('exit', code => (code === 0 ? resolve() : reject(new Error(`docker build exit ${code}`))))
    proc.on('error', reject)
  })
}

export type RunSandboxOptions = {
  jobId: string
  repoDir: string
  outDir: string
  env?: Record<string, string | undefined>
  onLog?: (line: string) => void
}

export async function runSandbox(opts: RunSandboxOptions): Promise<number> {
  const name = `analyzer-${opts.jobId}`
  const args = [
    'run', '--rm', '--network', 'none', '--memory=512m', '--cpus=1.0',
    '-v', `${opts.repoDir}:/repo:ro`,
    '-v', `${opts.outDir}:/out`,
    '-e', `OPENAI_API_KEY=${opts.env?.OPENAI_API_KEY || ''}`,
    '-e', `JOB_ID=${opts.jobId}`,
    '-e', `LLM_MODEL=${opts.env?.LLM_MODEL || 'gpt-4o-mini'}`,
    '--name', name,
    'analyzer-image'
  ]
  return await new Promise<number>((resolve, reject) => {
    const proc = spawn('docker', args)
    proc.stdout.on('data', (d) => {
      const lines = String(d).split('\n').filter(Boolean)
      lines.forEach(l => opts.onLog?.(l))
    })
    proc.stderr.on('data', (d) => {
      const lines = String(d).split('\n').filter(Boolean)
      lines.forEach(l => opts.onLog?.(l))
    })
    proc.on('exit', code => resolve(code ?? 1))
    proc.on('error', reject)
  })
}

export async function cleanupSandbox(jobId: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const proc = spawn('docker', ['rm', '-f', `analyzer-${jobId}`])
    proc.on('exit', () => resolve())
    proc.on('error', () => resolve())
  })
}

export function sandboxTmpDir(jobId: string): string {
  return path.join(process.cwd(), 'tmp', jobId)
}
