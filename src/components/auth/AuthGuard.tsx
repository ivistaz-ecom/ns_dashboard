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
      try {
        await window.NsApi.getCurrentUser()
        if (!cancelled) setStatus("ok")
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
