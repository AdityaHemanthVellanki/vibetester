import fetch from 'node-fetch'
import { config } from '@/lib/env'

function push(url: string, body: string) {
  return fetch(`${url}/metrics/job/ai-test-architect`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body })
}

export async function inc(name: string, labels: Record<string,string>, value = 1) {
  const gw = config.observability.pushgateway
  if (!gw) return
  const labelStr = Object.entries(labels).map(([k,v]) => `${k}="${v}"`).join(',')
  const body = `${name}{${labelStr}} ${value}\n`
  await push(gw, body)
}

export async function redisConnectionError(code: string) {
  await inc('redis_connection_errors_total', { code }, 1)
}
