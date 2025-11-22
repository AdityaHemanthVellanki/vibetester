import React from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import StatCard from '@/components/StatCard'
import useSWR from 'swr'

type DayStat = { day: string; count: number }
type Stats = { jobsPerDay: DayStat[]; numUsers: number; activeApiKeys: number }

export default function UsagePage() {
  const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<Stats>
  const { data: stats } = useSWR<Stats>('/api/admin/usage', fetcher)

  return (
    <DashboardLayout>
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Users" value={stats?.numUsers ?? 0} />
        <StatCard title="Active API Keys" value={stats?.activeApiKeys ?? 0} />
        <StatCard title="Jobs (7d)" value={(stats?.jobsPerDay || []).slice(-7).reduce((a: number, b: DayStat) => a + (b.count||0), 0)} />
      </div>
      <div className="mt-6">
        <div className="text-lg mb-2">Jobs per day</div>
        <div className="grid grid-cols-7 gap-2">
          {(stats?.jobsPerDay || []).slice(-7).map((d: DayStat, i: number) => (
            <div key={i} className="p-2 bg-white/5 rounded text-center animate-pulse">
              <div className="text-xs opacity-70">{d.day}</div>
              <div className="text-xl">{d.count}</div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
