import React from 'react'

type Key = { id: number; revoked: number; createdAt: number }

export default function ApiKeyCard({ k, onRevoke }: { k: Key; onRevoke: (id: number) => void }) {
  const masked = `••••••${String(k.id).slice(-4)}`
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded">
      <div>
        <div className="text-sm">{masked}</div>
        <div className="text-xs opacity-70">Created {new Date(k.createdAt*1000 || Date.now()).toLocaleString()}</div>
      </div>
      <button className="btn" onClick={() => onRevoke(k.id)} aria-label="Revoke">Revoke</button>
    </div>
  )
}