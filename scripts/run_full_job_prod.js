// Full job pipeline test
const fetch = global.fetch

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }

async function main() {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const gitUrl = process.env.TEST_GIT_URL || 'https://github.com/vercel/next.js'
  const post = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gitUrl }) })
  if (!post.ok) throw new Error(`enqueue failed: ${post.status}`)
  const { jobId } = await post.json()
  if (!jobId) throw new Error('no jobId')
  console.log('Enqueued job:', jobId)
  let status = 'queued'
  for (let i=0;i<60;i++) {
    await sleep(5000)
    const res = await fetch(`${base}/api/status?jobId=${encodeURIComponent(jobId)}`)
    if (!res.ok) throw new Error('status failed')
    const js = await res.json()
    status = js.status
    console.log('status:', status)
    if (status === 'done') break
    if (status === 'failed') throw new Error('job failed')
  }
  if (status !== 'done') throw new Error('timeout waiting for done')
  const resultRes = await fetch(`${base}/api/result?jobId=${encodeURIComponent(jobId)}`)
  if (!resultRes.ok) throw new Error('result fetch failed')
  const rr = await resultRes.json()
  const file = rr.files && rr.files[0]
  if (!file || !file.signedUrl) throw new Error('no signedUrl')
  const dl = await fetch(file.signedUrl)
  if (!dl.ok) throw new Error('download failed')
  console.log('Full job pipeline: PASS')
}

main().catch(e => { console.error('Full job pipeline: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
