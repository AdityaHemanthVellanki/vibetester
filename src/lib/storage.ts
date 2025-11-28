import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl as sign } from '@aws-sdk/s3-request-presigner'
import * as fs from 'fs/promises'
import * as path from 'path'
import { config } from '@/lib/env'

// Configured for Cloudflare R2 — uses endpoint override
// Paste your Cloudflare R2 credentials in .env (Access Keys)
// AWS-compatible: works with AWS SDK v3 presigned URLs

function client(): S3Client {
  return new S3Client({
    region: config.r2.region,
    credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
    endpoint: config.r2.endpoint,
    forcePathStyle: config.r2.forcePathStyle,
  })
}

const bucket = config.r2.bucket

export async function uploadOutDir(jobId: string, localPath: string): Promise<{ s3Prefix: string; files: { path: string; size: number }[] }>{
  const c = client()
  const keyPrefix = `${jobId}/out/`
  const files: { path: string; size: number }[] = []
  async function walk(dir: string) {
    const items = await fs.readdir(dir, { withFileTypes: true })
    for (const it of items) {
      const full = path.join(dir, it.name)
      if (it.isDirectory()) await walk(full)
      else {
        const rel = path.relative(localPath, full)
        const body = await fs.readFile(full)
        await c.send(new PutObjectCommand({ Bucket: bucket, Key: keyPrefix + rel, Body: body }))
        files.push({ path: rel, size: body.length })
      }
    }
  }
  await walk(localPath)
  return { s3Prefix: `${bucket}/${keyPrefix}`, files }
}

export async function getSignedUrlForKey(key: string, expiresSec = 3600): Promise<string> {
  const c = client()
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  return await sign(c, cmd, { expiresIn: expiresSec })
}

// Backward-compatible alias
export const getSignedUrl = getSignedUrlForKey

export async function listFiles(prefix: string): Promise<string[]>{
  const c = client()
  const res = await c.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
  return (res.Contents || []).map(o => o.Key!).filter(Boolean)
}
