const fetch = global.fetch

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }

async function main(){
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const gitUrl = process.env.TEST_GIT_URL || 'https://github.com/vercel/next.js'
  const outFile = 'ARTIFACTS/test_queue_flow.json'
  const artifacts = { steps: [], result: null }
  function log(step, data){ artifacts.steps.push({ ts: Date.now(), step, data }) }

  const resp = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gitUrl }) })
  if (!resp.ok) throw new Error(`enqueue failed: ${resp.status}`)
  const { jobId } = await resp.json()
  log('enqueue', { jobId })

  let status = 'queued'
  let progress_log = []
  for (let i=0;i<90;i++) {
    await sleep(2000)
    const s = await fetch(`${base}/api/status?jobId=${encodeURIComponent(jobId)}`)
    if (!s.ok) throw new Error('status failed')
    const js = await s.json()
    status = js.status
    progress_log = js.progress_log || []
    log('status', { status, progress_log_len: progress_log.length })
    if (status === 'done') break
    if (status === 'failed') break
  }
  if (status !== 'done') throw new Error(`pipeline did not complete: ${status}`)
  const r = await fetch(`${base}/api/result?jobId=${encodeURIComponent(jobId)}`)
  if (!r.ok) throw new Error('result fetch failed')
  const rr = await r.json()
  artifacts.result = rr
  const f0 = rr.files && rr.files[0]
  if (!f0 || !f0.signedUrl) throw new Error('no signedUrl')
  const dl = await fetch(f0.signedUrl)
  if (!dl.ok) throw new Error('download failed')
  require('fs').mkdirSync('ARTIFACTS', { recursive: true })
  require('fs').writeFileSync(outFile, JSON.stringify(artifacts, null, 2))
  console.log('queue flow: PASS')
}

main().catch(e => { console.error('queue flow: FAIL', e && e.message ? e.message : String(e)); process.exit(1) })
