"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "ok">("checking")

  useEffect(() => {
    let cancelled = false

    window.__nsOnUnauthorized = () => {
      router.replace("/login")
    }

    async function check() {
      if (!window.NsApi?.isLoggedIn()) {
        router.replace("/login")
        return
      }
      // Don't block the shell on a network round-trip — a stored token is enough
      // to render, and getCurrentUser() still invalidates a dead session.
      if (!cancelled) setStatus("ok")
      try {
        await window.NsApi.getCurrentUser()
      } catch {
        window.NsApi?.clearToken()
        router.replace("/login")
      }
    }
    check()

    return () => {
      cancelled = true
    }
  }, [router])

  if (status === "checking") {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Checking session…</div>
      </div>
    )
  }

  return <>{children}</>
}
