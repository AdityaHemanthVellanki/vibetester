import React, { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import ApiKeyCard from '@/components/ApiKeyCard'

type Key = { id: number; revoked: number; createdAt: number }

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<Key[]>([])
  const [newKey, setNewKey] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/apikeys')
    if (res.ok) {
      const json = await res.json()
      setKeys(json.keys || [])
    }
  }

  useEffect(() => { load() }, [])

  async function create() {
    const res = await fetch('/api/apikeys', { method: 'POST' })
    if (res.ok) {
      const json = await res.json()
      setNewKey(json.key)
      load()
    }
  }

  async function revoke(id: number) {
    await fetch(`/api/apikeys?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <DashboardLayout>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg">API Keys</div>
        <button className="btn btn-primary" onClick={create} aria-label="Create API Key">Create New API Key</button>
      </div>
      <div className="text-sm opacity-70 mb-2">Rate limit per minute: {process.env.RATE_LIMIT_PER_MINUTE || 30}</div>
      <div className="space-y-2">
        {keys.map(k => (<ApiKeyCard key={k.id} k={k} onRevoke={revoke} />))}
        {keys.length === 0 && <div className="opacity-70">No keys yet</div>}
      </div>
      {newKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="panel rounded-lg p-6 w-full max-w-md">
            <div className="text-lg mb-2">New API Key</div>
            <div className="text-sm mb-4 opacity-70">Store this key now. You cannot view it again.</div>
            <input value={newKey} readOnly className="w-full rounded bg-panel p-2 font-mono" />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => navigator.clipboard.writeText(newKey)} aria-label="Copy">Copy</button>
              <button className="btn btn-primary" onClick={() => setNewKey(null)} aria-label="Close">Close</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}