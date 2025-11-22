import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function client() {
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION || 'auto'
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || '')
  const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || '')
  return new S3Client({ endpoint, region, forcePathStyle, credentials: { accessKeyId, secretAccessKey } })
}

async function main() {
  const bucket = process.env.S3_BUCKET
  const c = client()
  const key = `test-${Date.now()}.txt`
  try {
    process.stdout.write('Putting object to Cloudflare R2...\n')
    await c.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from('hello r2') }))
    process.stdout.write('Creating signed URL...\n')
    const url = await getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 })
    process.stdout.write(`Signed URL: ${url}\n`)
    process.stdout.write('✅ R2 connectivity OK\n')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    process.stderr.write(`❌ R2 test failed: ${msg}\n`)
    process.stderr.write('If this fails, check Cloudflare R2 Access Keys and S3_ENDPOINT.\n')
    process.stderr.write('Cloudflare dashboard → R2 → Access Keys → Create Access Key.\n')
    process.exit(1)
  }
}

main()
