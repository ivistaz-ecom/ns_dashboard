"use client"

import { memo } from "react"
import { modalsHtml } from "./modalsHtml"

export const DashboardModals = memo(function DashboardModals() {
  return (
    <div
      className="dashboard-modals-host"
      dangerouslySetInnerHTML={{ __html: modalsHtml }}
      suppressHydrationWarning
    />
  )
})
