"use client"

import { dashboardPanelHtml } from "./dashboardPanelHtml"
import { HtmlPanel } from "@/components/shared/HtmlPanel"

export function DashboardPanel() {
  return <HtmlPanel html={dashboardPanelHtml} />
}
