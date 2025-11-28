import * as Sentry from '@sentry/node'

let inited = false
export function initSentry() {
  if (inited) return
  const dsn = process.env.SENTRY_DSN || ''
  const isPlaceholder = dsn === 'local-dev-sentry-dsn'
  const looksValid = /^https?:\/\//.test(dsn)
  if (!dsn || isPlaceholder || !looksValid) return
  Sentry.init({ dsn })
  inited = true
}

export function addRetryBreadcrumb(origJobId: string, newJobId: string, attemptedWithToken: boolean) {
  const dsn = process.env.SENTRY_DSN || ''
  const isPlaceholder = dsn === 'local-dev-sentry-dsn'
  const looksValid = /^https?:\/\//.test(dsn)
  if (!dsn || isPlaceholder || !looksValid) return
  try {
    Sentry.addBreadcrumb({ category: 'retry', message: `retry attempted`, data: { origJobId, newJobId, attemptedWithToken } })
  } catch {}
}
