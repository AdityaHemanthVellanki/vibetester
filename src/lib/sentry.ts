import * as Sentry from '@sentry/node'
let inited = false
import { config } from '@/lib/env'
export function initSentry() {
  if (inited) return
  const dsn = config.observability.sentryDsn || ''
  const isPlaceholder = dsn === 'local-dev-sentry-dsn'
  const looksValid = /^https?:\/\//.test(dsn)
  if (!dsn || isPlaceholder || !looksValid) return
  Sentry.init({ dsn })
  inited = true
}

export function addRetryBreadcrumb(origJobId: string, newJobId: string, attemptedWithToken: boolean) {
  const dsn = config.observability.sentryDsn || ''
  const isPlaceholder = dsn === 'local-dev-sentry-dsn'
  const looksValid = /^https?:\/\//.test(dsn)
  if (!dsn || isPlaceholder || !looksValid) return
  try {
    Sentry.addBreadcrumb({ category: 'retry', message: `retry attempted`, data: { origJobId, newJobId, attemptedWithToken } })
  } catch {}
}
