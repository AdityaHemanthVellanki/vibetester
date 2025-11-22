// S3 connectivity test: attempts PutObject, GetObject, and presigned URL
// If this fails, update .env with real AWS or MinIO credentials
// AWS: supply Access Key + Secret from IAM (Programmatic Access)
// MinIO: supply MINIO_ROOT_USER + MINIO_ROOT_PASSWORD

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

function client() {
  const endpoint = process.env.S3_ENDPOINT || undefined
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || 'changeme',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'changeme',
    },
    endpoint,
    forcePathStyle,
  })
}

async function main() {
  const bucket = process.env.S3_BUCKET || 'ai-test-architect-dev'
  const c = client()
  const key = `test/${Date.now()}.txt`
  try {
    process.stdout.write('Putting object...\n')
    await c.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from('hello s3') }))
    process.stdout.write('Getting object...\n')
    await c.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    process.stdout.write('Creating signed URL...\n')
    const url = await getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 })
    process.stdout.write(`Signed URL: ${url}\n`)
    process.stdout.write('✅ S3 connectivity OK\n')
  } catch (e) {
    process.stderr.write(`❌ S3 test failed: ${e && e.message ? e.message : e}\n`)
    process.stderr.write('If this fails, update .env with real AWS or MinIO credentials.\n')
    process.stderr.write('AWS: use IAM Access Key + Secret. MinIO: use MINIO_ROOT_USER + MINIO_ROOT_PASSWORD.\n')
    process.exit(1)
  }
}

main()