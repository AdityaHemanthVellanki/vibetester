import React from 'react'

export default function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="p-4 bg-white/5 rounded">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl mt-1">{value}</div>
    </div>
  )
}