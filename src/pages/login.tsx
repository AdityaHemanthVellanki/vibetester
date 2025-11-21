import React from 'react'
import LoginButton from '@/components/LoginButton'

export default function LoginPage() {
  return (
    <div className="dash min-h-screen flex items-center justify-center p-8">
      <div className="panel rounded-lg p-8 max-w-md w-full text-center">
        <div className="text-2xl mb-4">Sign in</div>
        <div className="opacity-70 mb-6">Continue with GitHub to access your dashboard</div>
        <LoginButton />
      </div>
    </div>
  )
}