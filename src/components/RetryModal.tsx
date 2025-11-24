import React, { useState } from 'react'

type Props = { open: boolean; onClose: () => void; jobId: string; onRetried: (newJobId: string) => void }

export default function RetryModal({ open, onClose, jobId, onRetried }: Props) {
  const [token, setToken] = useState('')
  const [onlyOnce, setOnlyOnce] = useState(true)
  if (!open) return null
  async function submit() {
    const body = { jobId, gitToken: token && token.length > 8 ? token : undefined }
    const r = await fetch('/api/analyze/retry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) {
      const json = await r.json()
      setToken('')
      onRetried(json.jobId)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md">
        <div className="text-lg mb-2">Private repo authentication</div>
        <div className="text-sm opacity-80 mb-3">Repo requires authentication. Provide a Personal Access Token (PAT) to retry clone. We never store your token.</div>
        <label className="block text-sm mb-1">Token</label>
        <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_xxx..." className="w-full rounded bg-panel p-2" />
        <div className="mt-2 text-xs opacity-70">See docs/PRIVATE_REPO.md for how to create a minimal PAT.</div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOnce} onChange={e => setOnlyOnce(e.target.checked)} />
          Use this token for this retry only
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose} aria-label="Cancel">Cancel</button>
          <button className="btn btn-primary" onClick={submit} aria-label="Retry">Retry</button>
        </div>
      </div>
    </div>
  )
}