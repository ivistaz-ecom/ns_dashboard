"use client"

import { memo } from "react"
import { modalsHtml } from "./modalsHtml"

export const DashboardModals = memo(function DashboardModals() {
  return (
    <div
      style={{ display: "contents" }}
      dangerouslySetInnerHTML={{ __html: modalsHtml }}
      suppressHydrationWarning
    />
  )
})
