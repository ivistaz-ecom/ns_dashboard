"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // If already logged in with a still-valid session, skip straight to the dashboard.
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!window.NsApi?.isLoggedIn()) {
        setChecking(false)
        return
      }
      try {
        await window.NsApi.getCurrentUser()
        if (!cancelled) router.replace("/")
      } catch {
        window.NsApi?.clearToken()
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!window.NsApi) {
      setError("API client not loaded yet — refresh and try again.")
      return
    }
    setLoading(true)
    try {
      await window.NsApi.login(username, password)
      router.replace("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Checking session…</div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Image src="/images/logo.webp" alt="Nautilus Shipping" width={140} height={42} priority />
          <div className="text-sm text-slate-500">Business Development Dashboard</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
