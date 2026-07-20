"use client"

import { usePathname } from "next/navigation"
import { tabFromPath } from "@/config/nav"

export function useActiveTab() {
  const pathname = usePathname()
  return tabFromPath(pathname)
}
