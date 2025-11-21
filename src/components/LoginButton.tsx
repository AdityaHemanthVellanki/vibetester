import React from 'react'

export default function LoginButton() {
  function login() {
    window.location.href = '/api/auth?action=login'
  }
  return (
    <button className="btn btn-primary w-full" onClick={login} aria-label="Continue with GitHub">Continue with GitHub</button>
  )
}