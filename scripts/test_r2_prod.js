// R2 end-to-end storage test (create, upload, presign, download, delete)
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

async function main() {
  const bucket = process.env.S3_BUCKET || ''
  if (!bucket) throw new Error('S3_BUCKET missing')
  const endpoint = process.env.S3_ENDPOINT || undefined
  const region = process.env.S3_REGION || 'auto'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || ''
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true'

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  })

  const key = `prod-verify/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`
  const body = Buffer.from('hello r2 prod verify')

  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }))
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 })
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status}`)
  const txt = await res.text()
  if (txt !== 'hello r2 prod verify') throw new Error('content mismatch')
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log('R2 storage test: PASS')
}

main().catch(e => { console.error('R2 storage test: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
