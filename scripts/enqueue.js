const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const repo = process.argv[2] || 'https://github.com/rauchg/nextjs-blog-starter';

async function main() {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gitUrl: repo }),
  });
  const data = await res.json();
  const jobId = data.jobId;
  console.log('jobId:', jobId);

  const statusUrl = `${API_BASE}/api/status?jobId=${jobId}`;
  const resultUrl = `${API_BASE}/api/result?jobId=${jobId}`;

  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    const sres = await fetch(statusUrl);
    const status = await sres.json();
    console.log('status:', status.status, 'latest:', status.progress[status.progress.length - 1]);
    if (status.status === 'done') break;
    if (status.status === 'failed') {
      console.error('failed:', status.error);
      process.exit(1);
    }
  }

  const rres = await fetch(resultUrl);
  if (!rres.ok) {
    console.error('Failed to download result');
    process.exit(1);
  }
  const buf = Buffer.from(await rres.arrayBuffer());
  const file = `tmp/demo-${jobId}.zip`;
  await import('fs').then(fs => fs.writeFileSync(file, buf));
  console.log('Downloaded:', file);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});