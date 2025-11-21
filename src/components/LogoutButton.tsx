import React from 'react'

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch('/api/auth?action=logout')
    } catch {}
    window.location.href = '/login'
  }
  return (
    <button className="btn" onClick={logout} aria-label="Logout">Logout</button>
  )
}