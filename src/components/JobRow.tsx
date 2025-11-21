import React from 'react'

type Job = { id: string; createdAt?: number; status: 'done'|'failed'|'processing'|'queued' }

export default function JobRow({ job, onOpen }: { job: Job; onOpen: (id: string) => void }) {
  const color = job.status === 'done' ? 'chip-green' : job.status === 'failed' ? 'chip-red' : 'chip-yellow'
  return (
    <div className="grid grid-cols-4 gap-2 p-2 hover:bg-white/5 rounded cursor-pointer" onClick={() => onOpen(job.id)}>
      <div className="font-mono text-xs">{job.id}</div>
      <div className="text-sm">{job.createdAt ? new Date(job.createdAt).toLocaleString() : ''}</div>
      <div className={`chip ${color}`}>{job.status}</div>
      <div className="text-sm link">Open</div>
    </div>
  )
}