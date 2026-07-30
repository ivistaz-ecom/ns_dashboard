"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Analytics is temporarily hidden — redirect if hit directly. */
export default function AnalyticsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/")
  }, [router])

  return null
}
