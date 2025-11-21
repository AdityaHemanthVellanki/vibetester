import React, { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import JobRow from '@/components/JobRow'

type Job = { id: string; createdAt?: number; status: 'done'|'failed'|'processing'|'queued' }

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [page, setPage] = useState(1)

  async function load() {
    let res = await fetch('/api/jobs')
    if (!res.ok) res = await fetch('/api/status?list=true')
    if (res.ok) {
      const json = await res.json()
      setJobs(json.jobs || json || [])
    } else {
      setJobs([])
    }
  }

  useEffect(() => { load() }, [])

  return (
    <DashboardLayout>
      <div className="text-lg mb-4">Jobs</div>
      <div className="space-y-1">
        {jobs.map(j => (<JobRow key={j.id} job={j} onOpen={(id) => { window.location.href = `/job/${id}` }} />))}
        {jobs.length === 0 && <div className="opacity-70">No jobs yet</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn" onClick={() => { setPage(p => p+1); }} aria-label="Load More">Load More</button>
        <button className="btn" onClick={load} aria-label="Refresh">Refresh</button>
      </div>
    </DashboardLayout>
  )
}