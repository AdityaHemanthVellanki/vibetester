import * as Sentry from '@sentry/node'

let inited = false
export function initSentry() {
  if (inited) return
  if (!process.env.SENTRY_DSN) return
  Sentry.init({ dsn: process.env.SENTRY_DSN })
  inited = true
}

export function addRetryBreadcrumb(origJobId: string, newJobId: string, attemptedWithToken: boolean) {
  if (!process.env.SENTRY_DSN) return
  try {
    Sentry.addBreadcrumb({ category: 'retry', message: `retry attempted`, data: { origJobId, newJobId, attemptedWithToken } })
  } catch {}
}
