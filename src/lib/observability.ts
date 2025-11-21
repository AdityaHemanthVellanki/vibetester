import fetch from 'node-fetch'

export async function pushMetric(name: string, labels: Record<string,string>, value: number) {
  const url = process.env.PROMETHEUS_PUSHGATEWAY
  if (!url) return
  const labelStr = Object.entries(labels).map(([k,v]) => `${k}="${v}"`).join(',')
  const body = `${name}{${labelStr}} ${value}\n`
  await fetch(`${url}/metrics/job/ai-test-architect`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
}