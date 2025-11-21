import React, { useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import StatCard from '@/components/StatCard'

export default function UsagePage() {
  const [stats, setStats] = useState<any | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/usage')
      if (res.ok) setStats(await res.json())
      else setStats({ jobsPerDay: [], numUsers: 0, activeApiKeys: 0 })
    }
    load()
  }, [])

  return (
    <DashboardLayout>
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Users" value={stats?.numUsers ?? 0} />
        <StatCard title="Active API Keys" value={stats?.activeApiKeys ?? 0} />
        <StatCard title="Jobs (7d)" value={(stats?.jobsPerDay || []).slice(-7).reduce((a: number, b: any) => a + (b.count||0), 0)} />
      </div>
      <div className="mt-6">
        <div className="text-lg mb-2">Jobs per day</div>
        <div className="grid grid-cols-7 gap-2">
          {(stats?.jobsPerDay || []).slice(-7).map((d: any, i: number) => (
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