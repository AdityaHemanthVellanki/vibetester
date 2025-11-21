import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl as sign } from '@aws-sdk/s3-request-presigner'
import * as fs from 'fs/promises'
import * as path from 'path'

function client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || ''
    }
  })
}

const bucket = process.env.S3_BUCKET || ''

export async function uploadOutDir(jobId: string, localPath: string): Promise<{ s3Prefix: string; files: { path: string; size: number }[] }>{
  const c = client()
  const prefix = `ai-test-architect/${jobId}/out/`
  const files: { path: string; size: number }[] = []
  async function walk(dir: string) {
    const items = await fs.readdir(dir, { withFileTypes: true })
    for (const it of items) {
      const full = path.join(dir, it.name)
      if (it.isDirectory()) await walk(full)
      else {
        const rel = path.relative(localPath, full)
        const body = await fs.readFile(full)
        await c.send(new PutObjectCommand({ Bucket: bucket, Key: prefix + rel, Body: body }))
        files.push({ path: rel, size: body.length })
      }
    }
  }
  await walk(localPath)
  return { s3Prefix: prefix, files }
}

export async function getSignedUrl(key: string): Promise<string> {
  const c = client()
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
  return await sign(c, cmd, { expiresIn: 900 })
}

export async function listFiles(prefix: string): Promise<string[]>{
  const c = client()
  const res = await c.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))
  return (res.Contents || []).map(o => o.Key!).filter(Boolean)
}