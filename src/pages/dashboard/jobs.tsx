import React from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import JobRow from '@/components/JobRow'
import useSWR from 'swr'

type Job = { id: string; createdAt?: number; status: 'done'|'failed'|'processing'|'queued' }

export default function JobsPage() {
  const { data, isLoading, error, mutate } = useSWR('/api/status?list=true', (url: string) => fetch(url).then(r => r.json()))
  const jobs: Job[] = (data?.jobs || data || []) as Job[]
  

  async function load() { await mutate() }

  return (
    <DashboardLayout>
      <div className="text-lg mb-4">Jobs</div>
      <div className="space-y-1">
        {jobs.map(j => (<JobRow key={j.id} job={j} onOpen={(id) => { window.location.href = `/job/${id}` }} />))}
        {!isLoading && !error && jobs.length === 0 && <div className="opacity-70">No jobs yet</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn" onClick={load} aria-label="Refresh">Refresh</button>
      </div>
    </DashboardLayout>
  )
}
