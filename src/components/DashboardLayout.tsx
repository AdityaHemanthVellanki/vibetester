import React, { useEffect, useState } from 'react'
import LogoutButton from './LogoutButton'

type User = { id: number; email: string; githubId: string }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    async function load() {
      const res1 = await fetch('/api/me')
      if (res1.ok) { setUser(await res1.json()); return }
      const res2 = await fetch('/api/auth?action=me')
      if (res2.ok) { setUser(await res2.json()); return }
      window.location.href = '/login'
    }
    load()
  }, [])

  return (
    <div className="dash min-h-screen">
      <div className="flex">
        <aside className="sidebar hidden md:block panel min-h-screen p-4">
          <div className="text-lg mb-4">Dashboard</div>
          <nav className="space-y-2">
            <a className="block link" href="/dashboard">Overview</a>
            <a className="block link" href="/dashboard/api-keys">API Keys</a>
            <a className="block link" href="/dashboard/jobs">Jobs</a>
            <a className="block link" href="/dashboard/usage">Usage</a>
            <a className="block link" href="/">Settings</a>
          </nav>
        </aside>
        <main className="flex-1 p-4">
          <header className="panel rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-medium">{user?.email || ''}</div>
              <div className="text-sm opacity-70">{user?.githubId || ''}</div>
            </div>
            <LogoutButton />
          </header>
          <div className="panel rounded-lg p-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}