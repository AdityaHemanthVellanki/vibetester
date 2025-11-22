import React from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import StatCard from '@/components/StatCard'
import Link from 'next/link'

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Jobs (7d)" value={12} />
        <StatCard title="Avg Duration" value={'42s'} />
        <StatCard title="Active API Keys" value={2} />
      </div>
      <div className="mt-6">
        <Link className="btn btn-primary" href="/">Upload Repo</Link>
      </div>
    </DashboardLayout>
  )
}
